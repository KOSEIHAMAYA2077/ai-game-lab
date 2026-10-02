#include <metal_stdlib>
using namespace metal;
constant float TAU = 6.2831853071795864769;
struct GlyphInstance { float4 atlasRect; float4 ink; float4 material; float4 source; uint4 identity; };
struct Uniforms {
    float4x4 viewProjection;
    float4x4 rotation;
    float4 body; // time, growth, formation, glyphSize
    float4 params; // distance, alignment, switchTime, bornSize
    uint4 mode; // shape, previousShape, glyphCount, seed
};
struct Frame { float3 p, u, v; };
uint hashUnit(uint x) { x=(x^(x>>16))*0x21f0aaad; x=(x^(x>>15))*0x735a2d97; return x^(x>>15); }
float randomUnit(uint x) { return float(hashUnit(x))/4294967296.0; }
float seedPhase(uint seed,uint salt) { return randomUnit(seed+salt)*TAU; }
void shear(thread Frame &f,uint axis,float angle,float derivative) {
    uint i=(axis+1)%3,j=(axis+2)%3; float c=cos(angle),s=sin(angle);
    float x=c*f.p[i]-s*f.p[j],y=s*f.p[i]+c*f.p[j];
    float ux=c*f.u[i]-s*f.u[j]-y*derivative*f.u[axis],uy=s*f.u[i]+c*f.u[j]+x*derivative*f.u[axis];
    float vx=c*f.v[i]-s*f.v[j]-y*derivative*f.v[axis],vy=s*f.v[i]+c*f.v[j]+x*derivative*f.v[axis];
    f.p[i]=x;f.p[j]=y;f.u[i]=ux;f.u[j]=uy;f.v[i]=vx;f.v[j]=vy;
}
Frame sphere(float2 ab,float t,uint seed) {
    float a=ab.x*TAU,y=2*ab.y-1,r=sqrt(max(0.0,1-y*y)),c=cos(a),s=sin(a);
    Frame f={float3(r*c,y,r*s),float3(-s,0,c),float3(y*c,-r,y*s)};
    float q=2.4*f.p.y+.075*t+seedPhase(seed,71);
    shear(f,1,.13*t+.65*sin(q),1.56*cos(q));
    q=2.8*f.p.x-.063*t+seedPhase(seed,119);shear(f,0,.5*sin(q),1.4*cos(q));
    q=2.6*f.p.z+.043*t+seedPhase(seed,213);shear(f,2,.4*sin(q),1.04*cos(q));
    return f;
}
Frame cube(float2 ab,float t,uint seed) {
    Frame f=sphere(ab,t,seed); float3 p2=f.p*f.p,p4=p2*p2,p8=p4*p4,p11=p8*p2*f.p;
    float sum=dot(f.p,p11),m=pow(sum,1.0/12.0);
    f.u=(f.u-f.p*(dot(f.u,p11)/sum))/m;f.v=(f.v-f.p*(dot(f.v,p11)/sum))/m;f.p/=m;return f;
}
Frame mobiusMap(float u,float w,float t) {
    float a=2*u-.09*t,b=3*u+.071*t,theta=u+.22*sin(a)+.08*sin(b);
    float r=1.25+.23*cos(2*u+.11*t)+.10*sin(3*u-.073*t);
    float twist=u/2+.65*sin(u-.13*t)+.22*sin(3*u+.071*t)+.3*sin(.091*t),width=1+.18*sin(2*u-.1*t);
    float cw=cos(twist),sw=sin(twist),ct=cos(theta),st=sin(theta),radial=r+w*width*cw,sy=.84+.07*sin(.069*t);
    Frame f;
    f.p=float3(radial*ct,radial*st*sy,w*width*sw+.22*sin(2*u+.083*t)+.12*cos(3*u-.097*t));
    float thetaU=1+.44*cos(a)+.24*cos(b),rU=-.46*sin(2*u+.11*t)+.3*cos(3*u-.073*t);
    float twistU=.5+.65*cos(u-.13*t)+.66*cos(3*u+.071*t),widthU=.36*cos(2*u-.1*t);
    float radialU=rU+w*(widthU*cw-width*sw*twistU);
    f.u=float3(radialU*ct-radial*st*thetaU,(radialU*st+radial*ct*thetaU)*sy,w*(widthU*sw+width*cw*twistU)+.44*cos(2*u+.083*t)-.36*sin(3*u-.097*t));
    f.v=float3(width*cw*ct,width*cw*st*sy,width*sw);return f;
}
Frame surface(uint shape,float2 ab,float t,uint seed) {
    if(shape==0)return sphere(ab,t,seed);if(shape==1)return cube(ab,t,seed);
    float q=2*ab.y-1,p=seedPhase(seed,43),base=ab.x*TAU*2+t*.13;
    float u=base+.48*q*sin(base/2+t*.061+p)+.19*sin(2*base-t*.071+p);
    float drift=.35*sin(u/2+t*.09+p)+.12*sin(1.5*u-t*.057+p);
    return mobiusMap(u,.47*(q+drift)/(1+q*drift),t);
}
Frame normalizeFrame(Frame f) {
    f.u=normalize(f.u); f.v-=f.u*dot(f.u,f.v);
    if(length_squared(f.v)<1e-20) {float3 a=abs(f.u.x)<.8?float3(1,0,0):float3(0,1,0);f.v=a-f.u*dot(f.u,a);}
    f.v=normalize(f.v);return f;
}
struct Raster { float4 position [[position]]; float2 uv; float3 ink; float light; };
vertex Raster glyphVertex(uint vertexID [[vertex_id]],uint instanceID [[instance_id]],constant Uniforms &u [[buffer(0)]],const device GlyphInstance *instances [[buffer(1)]]) {
    const float2 quad[6]={float2(-.5,-.5),float2(.5,-.5),float2(-.5,.5),float2(.5,-.5),float2(.5,.5),float2(-.5,.5)};
    GlyphInstance g=instances[instanceID];float t=u.body.x,age=t-g.material.z;
    Frame f=surface(u.mode.x,g.material.xy,t,u.mode.w);f=normalizeFrame(f);
    float blend=smoothstep(0.0,1.6,t-u.params.z);
    float3 center=f.p*u.body.z*(u.mode.x==0?1.2:1.0);
    if(blend<1 && u.mode.x!=u.mode.y)center=mix(surface(u.mode.y,g.material.xy,u.params.z,u.mode.w).p*u.body.z*(u.mode.y==0?1.2:1.0),center,blend);
    if(u.mode.z==1)center=float3(.018*sin(t*1.3),.024*sin(t*.9),.012*sin(t));
    float arrival=clamp((age-randomUnit(g.identity.y+5)*.2)/(2.4+randomUnit(g.identity.y+4)*1.1),0.0,1.0);
    if(arrival<1) {
        float smooth=arrival*arrival*(3-2*arrival),envelope=pow(max(0.0,sin(M_PI_F*arrival)),1.5);
        float angle=randomUnit(g.identity.y)*TAU+arrival*TAU*(1.1+randomUnit(g.identity.y+1)*1.8);
        float radius=(.18+randomUnit(g.identity.y+2)*.5)*envelope;
        center=mix(g.source.xyz,center,smooth)+float3(radius*cos(angle),radius*sin(angle),(.2+randomUnit(g.identity.y+3)*.5)*envelope*sin(angle*.71));
    }
    float phase=g.material.w,pulse=1+.06*sin(t*.19+phase),roll=.12*sin(t*.13+phase*1.3);
    float2 q2=quad[vertexID]*u.body.w*pulse;float c=cos(roll),s=sin(roll);
    float2 on=float2(c*q2.x-s*q2.y,s*q2.x+c*q2.y);
    float pitch=.15*sin(t*.17+phase),yaw=phase+t*(.09+.025*sin(phase));
    float3 free=float3(q2.x,cos(pitch)*q2.y,sin(pitch)*q2.y);
    free=float3(cos(yaw)*free.x+sin(yaw)*free.z,free.y,-sin(yaw)*free.x+cos(yaw)*free.z);
    free=float3(c*free.x-s*free.y,s*free.x+c*free.y,free.z);
    float3 plane=mix(free,f.u*on.x+f.v*on.y,u.params.y*blend);
    float settled=smoothstep(0.0,3.8,age);
    float3 worldCenter=(u.rotation*float4(center*u.body.y,1)).xyz;
    float3 worldPlane=(u.rotation*float4(plane*u.body.y,0)).xyz;
    float3 birthPlane=float3(quad[vertexID]*g.source.w,0);
    Raster out;out.position=u.viewProjection*float4(worldCenter+mix(birthPlane,worldPlane,settled),1);
    // Atlas rows are top-down CoreGraphics pixels; material Y is upright.
    out.uv=g.atlasRect.xy+float2(quad[vertexID].x+.5,.5-quad[vertexID].y)*g.atlasRect.zw;
    float freshness=1-smoothstep(.6,7.6,age);
    out.ink=mix(float3(.94,.95,.94),g.ink.xyz,g.ink.w>.5?1.0:freshness);
    out.light=.30+.70*clamp((1.6*u.body.y+worldCenter.z)/(3.2*u.body.y),0.0,1.0);
    if(u.mode.x!=2) {
        float3 normal=normalize((u.rotation*float4(cross(f.u,f.v),0)).xyz);
        float facing=dot(normal,normalize(float3(0,0,u.params.x)-worldCenter));
        float nearSide=smoothstep(-.08,.18,facing),coating=smoothstep(.3,.96,u.params.y)*settled;
        out.light*=mix(1.0,nearSide,coating);
    }
    return out;
}
fragment float4 glyphFragment(Raster r [[stage_in]],texture2d<float> atlas [[texture(0)]]) {
    constexpr sampler sample(filter::linear,address::clamp_to_edge);
    float alpha=atlas.sample(sample,r.uv).a;
    if(alpha<.06)discard_fragment();return float4(r.ink,alpha*r.light);
}
struct ValidationInput { float4 materialTime;uint4 identity; };
struct ValidationOutput { float4 p;float4 u;float4 v; };
kernel void validateSurface(const device ValidationInput *input [[buffer(0)]],device ValidationOutput *output [[buffer(1)]],uint id [[thread_position_in_grid]]) {
    ValidationInput value=input[id];Frame f=surface(value.identity.x,value.materialTime.xy,value.materialTime.z,value.identity.y);
    output[id]={float4(f.p,0),float4(f.u,0),float4(f.v,0)};
}

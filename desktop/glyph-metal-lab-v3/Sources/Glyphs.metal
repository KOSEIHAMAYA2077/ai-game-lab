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
    float4 wordSeeds; // current reduced material/time phases; no per-glyph CPU updates.
    float4 wordTime1; float4 wordTime2; float4 wordTime3; float4 wordTime4;
    float4 previousWordSeeds; float4 previousWordTime1; float4 previousWordTime2; float4 previousWordTime3; float4 previousWordTime4;
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
float3 wordPoint(uint shape,float u,float v,float t,uint part,float4 wa,float4 wb,float4 wc,float4 wd,float4 we) {
    float a=u*TAU,c=cos(a),s=sin(a),b=M_PI_F*v;
    if(shape==4 || shape==11) {
        float q=(v-.62)/.26,k=(v-.015)/.065;
        float radius=shape==4?.28+.63*exp(-q*q)+.16*exp(-k*k):.18+.75*pow(abs(2*v-1),1.35);
        float wave=1+.035*sin(3*a+4*v+wa.w);
        return float3(radius*c*wave,1.3-2.6*v,radius*s*wave);
    }
    if(shape==6) {
        float r=sqrt(max(0.0,1-v))*(1.02+.35*cos(5*a));
        float cup=.24*r*r+.10*cos(5*a+wd.x)*r;
        return float3(r*c,r*s,cup+.08*sin(wd.y+2*a)*r);
    }
    if(shape==7) {
        if(part<2)return float3(.07*sin(b)*c,.85*cos(b),.06*sin(b)*s);
        float side=part%2==0?-1.0:1.0,r=sqrt(max(0.0,1-v)),wing=.68+.23*sin(a)-.2*cos(2*a);
        float x=side*(.025+r*wing*(1+c)*.74),y=r*s*(1.05+.19*s);
        float flap=.24*sin(wc.x)+.10*sin(wd.z);
        return float3(x*cos(flap),y,abs(x)*sin(flap)+.07*r*sin(3*a+wd.w));
    }
    if(shape==8) {
        if(part<9) {
            float layer=float(part%3),top=1.4-layer*.53,rise=sqrt(max(0.0,v));
            float r=(.57+.2*layer)*(.012+.988*rise),ripple=1+.025*sin(a*5+wb.z+v);
            return float3(r*c*ripple,top-.95*rise,r*s*ripple);
        }
        return float3(.14*c,-.65-.8*v,.14*s);
    }
    if(shape==9) {
        float angle=fract(u)*TAU,sector=floor(angle/(M_PI_F/5)),f=angle-sector*M_PI_F/5;
        bool odd=uint(sector)%2!=0;float r0=odd?.53:1.2,r1=odd?1.2:.53;
        float radial=r0*r1*sin(M_PI_F/5)/(r1*sin(M_PI_F/5-f)+r0*sin(f));
        float height=1-2*v,r=sqrt(max(0.0,1-height*height)),z=.20*height;
        return float3(radial*r*sin(a),radial*r*cos(a),z*(1+.07*sin(wa.w)));
    }
    if(shape==10) {
        float turn=v*TAU*2.2+.10*sin(wd.w),radius=.66+.08*sin(v*TAU+we.y),q=radius+.13*c;
        return float3(q*cos(turn),1.35-2.7*v+.13*s,q*sin(turn));
    }
    if(shape==12) {
        if(part<6) {float r=.72*sin(b);return float3(r*c,.72*cos(b),r*s);}
        float r=1.05+v*.45,tilt=.38+.045*sin(we.x);
        return float3(r*c,r*s*sin(tilt),r*s*cos(tilt));
    }
    if(shape==3) {
        if(part<7) {float r=pow(max(0.0,sin(b)),.35);return float3(.20*c*r,1.6-2.28*v,.065*s*r);}
        if(part<9)return float3(.64-1.28*v,-.65+.10*c,.10*s);
        return float3(.10*c,-.72-.68*v,.10*s);
    }
    // Authored jellyfish: 24 bell patches, then 8 lagged tube arms.
    float phase=wb.x,pulse=pow(.5+.5*sin(phase),2.0);
    float bob=.055*sin(wb.y)+.015*sin(wa.w);
    if(part<24) {
        float y=1-v*.97;
        float r=sqrt(max(0.0,1-y*y))*(1-.10*pulse)*(1+.015*v*v*sin(8*a+wb.z));
        return float3(r*c,.1+.9*y*(1+.065*pulse)+bob-.025*v*v*pulse,r*s);
    }
    float arm=float(part-24),angle=arm*TAU/8;
    float rootY=.127+.001755*pulse+bob-.025*pulse;
    float y=rootY-v*(1.65+.05*sin(phase-v*1.8)),lag=pow(v,1.25);
    float bend=lag*(.16*sin(v*5+wb.w+arm*.77)+.045*sin(wc.x+arm*1.13+v*7));
    float radius=.017+.014*(1-v);
    float r=(sqrt(1-.03*.03)+.10*v)*(1-.10*pow(1-v,2.0)*pulse)*(1+.015*sin(8*angle+wb.z));
    return float3(r*cos(angle)+bend+radius*c,y,r*sin(angle)+lag*.14*sin(v*4+wc.y+arm*.63)+radius*s);
}
Frame wordPointFrame(uint shape,float u,float v,float t,uint part,float4 wa,float4 wb,float4 wc,float4 wd,float4 we) {
    // Float-stable central differences on the same authored patch. Keep V
    // inside the valid chart near a pole; Double TS uses a fixed 1e-5 step.
    const float hu=.0001;
    float hv=min(.0001,min(v,1-v));
    Frame f;
    f.p=wordPoint(shape,u,v,t,part,wa,wb,wc,wd,we);
    if(shape==7) {
        // Analytic differential of the unchanged authored butterfly patch.
        // A finite difference loses the tiny perpendicular component where
        // the two wing coordinates meet. The chart is singular at u=.5 when
        // the wing undulation phase also vanishes.
        float a=u*TAU,c=cos(a),s=sin(a),b=M_PI_F*v;
        // Exact authored seam values prevent Float sin(pi) residue from
        // inventing a normal for the wing chart when its undulation phase also vanishes.
        if(u==.5){c=-1;s=0;}
        if(part<2) {
            f.u=float3(-.07*sin(b)*s,0,.06*sin(b)*c)*TAU;
            f.v=float3(.07*cos(b)*c,-.85*sin(b),.06*cos(b)*s)*M_PI_F;
        } else {
            float side=part%2==0?-1.0:1.0,r=sqrt(1-v),rv=-.5/r;
            float wing=.68+.23*s-.2*cos(2*a),wingA=.23*c+.4*(u==.5?0.0:sin(2*a));
            float bx=.74*wing*(1+c),bxA=.74*(wingA*(1+c)-wing*s);
            float by=s*(1.05+.19*s),byA=c*(1.05+.38*s);
            float flap=.24*sin(wc.x)+.10*sin(wd.z),cf=cos(flap),sf=sin(flap);
            float xu=side*r*bxA*TAU,xv=side*rv*bx,yu=r*byA*TAU,yv=rv*by;
            float q=3*a+wd.w,qs=u==.5?-sin(wd.w):sin(q),qc=u==.5?-cos(wd.w):cos(q);
            f.u=float3(xu*cf,yu,side*xu*sf+.21*r*qc*TAU);
            f.v=float3(xv*cf,yv,side*xv*sf+.07*rv*qs);
        }
        return f;
    }
    f.u=(wordPoint(shape,u+hu,v,t,part,wa,wb,wc,wd,we)-wordPoint(shape,u-hu,v,t,part,wa,wb,wc,wd,we))/(2*hu);
    f.v=(wordPoint(shape,u,v+hv,t,part,wa,wb,wc,wd,we)-wordPoint(shape,u,v-hv,t,part,wa,wb,wc,wd,we))/(2*hv);
    if(shape==3 && part>=7 && part<9)f.v=-f.v;
    return f;
}
Frame wordFrame(uint shape,float2 ab,float t,uint glyphID,float4 wa,float4 wb,float4 wc,float4 wd,float4 we) {
    uint part=glyphID%(shape==5?32:shape==7?20:10);
    // Authored surfaces are periodic in u. Keep the chart small enough for
    // Float finite differences after a long time; mathematical positions match.
    float u=fract(ab.x+wa.x+.055*sin(ab.y*TAU+wa.y));
    float v=clamp(ab.y+.065*sin(M_PI_F*ab.y)*sin(ab.x*TAU+wa.z),.00001,.99999);
    return wordPointFrame(shape,u,v,t,part,wa,wb,wc,wd,we);
}
Frame surface(uint shape,float2 ab,float t,uint seed,uint glyphID,float4 wa,float4 wb,float4 wc,float4 wd,float4 we) {
    if(shape==0)return sphere(ab,t,seed);if(shape==1)return cube(ab,t,seed);
    if(shape>=3)return wordFrame(shape,ab,t,glyphID,wa,wb,wc,wd,we);
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
    Frame f=surface(u.mode.x,g.material.xy,t,u.mode.w,g.identity.x,u.wordSeeds,u.wordTime1,u.wordTime2,u.wordTime3,u.wordTime4);f=normalizeFrame(f);
    float blend=smoothstep(0.0,1.6,t-u.params.z);
    float3 center=f.p*u.body.z*(u.mode.x==0?1.2:1.0);
    if(blend<1 && u.mode.x!=u.mode.y)center=mix(surface(u.mode.y,g.material.xy,u.params.z,u.mode.w,g.identity.x,u.previousWordSeeds,u.previousWordTime1,u.previousWordTime2,u.previousWordTime3,u.previousWordTime4).p*u.body.z*(u.mode.y==0?1.2:1.0),center,blend);
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
    // Mirror CLOSED_WORD_SURFACES; flower, butterfly, jellyfish and Saturn
    // retain two-sided authored patches rather than inheriting sphere coating.
    if(u.mode.x==0 || u.mode.x==1 || u.mode.x==3 || u.mode.x==4 || u.mode.x==8 || u.mode.x==9 || u.mode.x==10 || u.mode.x==11) {
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
struct ValidationInput { float4 materialTime;uint4 identity;float4 wordSeeds;float4 wordTime1;float4 wordTime2;float4 wordTime3;float4 wordTime4; };
struct ValidationOutput { float4 p;float4 u;float4 v; };
kernel void validateSurface(const device ValidationInput *input [[buffer(0)]],device ValidationOutput *output [[buffer(1)]],uint id [[thread_position_in_grid]]) {
    ValidationInput value=input[id];Frame f=surface(value.identity.x,value.materialTime.xy,value.materialTime.z,value.identity.y,value.identity.z,value.wordSeeds,value.wordTime1,value.wordTime2,value.wordTime3,value.wordTime4);
    output[id]={float4(f.p,0),float4(f.u,0),float4(f.v,0)};
}
kernel void validateWordPoint(const device ValidationInput *input [[buffer(0)]],device ValidationOutput *output [[buffer(1)]],uint id [[thread_position_in_grid]]) {
    ValidationInput value=input[id];
    Frame f=wordPointFrame(value.identity.x,fract(value.materialTime.x),value.materialTime.y,value.materialTime.z,value.identity.z,value.wordSeeds,value.wordTime1,value.wordTime2,value.wordTime3,value.wordTime4);
    output[id]={float4(f.p,0),float4(f.u,0),float4(f.v,0)};
}

// Same Gram-Schmidt/fallback policy as the original Web surface-frame.ts.
kernel void validateWordBasis(const device ValidationInput *input [[buffer(0)]],device ValidationOutput *output [[buffer(1)]],uint id [[thread_position_in_grid]]) {
    ValidationInput value=input[id];
    Frame f=normalizeFrame(wordPointFrame(value.identity.x,fract(value.materialTime.x),value.materialTime.y,value.materialTime.z,value.identity.z,value.wordSeeds,value.wordTime1,value.wordTime2,value.wordTime3,value.wordTime4));
    output[id]={float4(f.p,0),float4(f.u,0),float4(f.v,0)};
}

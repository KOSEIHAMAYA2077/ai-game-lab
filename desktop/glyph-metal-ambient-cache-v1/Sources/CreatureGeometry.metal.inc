// Direct authored rest surfaces + original LBS weights. Included in Glyphs.metal
// by the reproducible source assembly script; no runtime include resolution.
struct CreatureUniforms { float4x4 matrices[18]; float4 currentPhase; float4 previousPhase; uint4 counts; };
float3 creatureEllipsoid(float u,float v,float3 center,float3 radius) {
    float a=u*TAU,b=acos(clamp(1-2*v,-1.0,1.0)),r=sin(b);
    return center+radius*float3(r*cos(a),cos(b),r*sin(a));
}
float3 creatureTriangle(float u,float v,float2 a,float2 b,float2 c,float z) {
    float q=fract(u)*3;uint i=uint(floor(q));float f=q-float(i),r=sqrt(max(0.0,v));
    float2 p=i==0?a:i==1?b:c,next=i==0?b:i==1?c:a,center=(a+b+c)/3;
    return float3(center+(p+(next-p)*f-center)*r,z);
}
float3 creatureRest(uint shape,float u,float v,uint part) {
    float a=u*TAU,c=cos(a),s=sin(a),b=M_PI_F*v;part%=64;
    if(shape==13) {
        if(part<45)return creatureEllipsoid(u,v,float3(.1,0,0),float3(.94,.45,.29));
        if(part<58)return creatureTriangle(u,v,float2(-.68,0),float2(-1.36,.64),float2(-1.36,-.64),part%2?.055:-.055);
        return float3(.15-.65*v,.33+.43*sin(b)*abs(c),.065*s*sin(b));
    }
    if(shape==14) {
        if(part<16)return creatureEllipsoid(u,v,float3(0,-.03,0),float3(.27,.58,.25));
        if(part<24)return creatureEllipsoid(u,v,float3(0,.61,0),float3(.23,.25,.23));
        if(part<28)return float3(.075*c*(1-v),.66+.075*s*(1-v),.22+.31*v);
        if(part>=58)return creatureTriangle(u,v,float2(-.19,-.49),float2(.19,-.49),float2(0,-1.01),part%2?.047:-.047);
        float3 p=creatureTriangle(u,v,float2(.18,.23),float2(1.42,.52),float2(.55,-.25),.05*sin(a));p.x*=part%2?1.0:-1.0;return p;
    }
    if(part>=58)return creatureEllipsoid(u,v,float3(.49,1.14,.08),float3(.28,.20,.23));
    float q=v*TAU*1.3,r=.115+.035*(1-v);
    return float3(.51*cos(q)+r*c,1.1-2.30*v,.18*sin(q)+r*s);
}
float creatureSmooth(float x) {float q=clamp(x,0.0,1.0);return q*q*(3-2*q);}
void creatureWeights(uint shape,uint part,float v,float3 p,thread uint3 &indices,thread float3 &weights) {
    indices=uint3(0);weights=float3(1,0,0);
    if(shape==14) {
        if(part>=16 && part<28){indices.x=1;return;}
        if(part>=58){indices.y=6;weights.y=creatureSmooth((-p.y-.42)/.25);weights.x=1-weights.y;return;}
        if(part>=28){uint shoulder=part%2?4:2;float a=creatureSmooth((abs(p.x)-.13)/.30),tip=creatureSmooth((abs(p.x)-.64)/.45);indices=uint3(0,shoulder,shoulder+1);weights=float3(1-a,a*(1-tip),a*tip);}
    } else if(shape==13) {
        const float anchors[4]={.35,-.20,-.68,-1.18};uint i=p.x>=-.20?0:p.x>=-.68?1:2;indices=uint3(i,i+1,0);weights.y=creatureSmooth((anchors[i]-p.x)/(anchors[i]-anchors[i+1]));weights.x=1-weights.y;
    } else if(part<58) {
        float at=clamp(v,0.0,1.0)*8;uint i=min(7u,uint(floor(at)));indices=uint3(i,i+1,0);weights.y=creatureSmooth(at-float(i));weights.x=1-weights.y;
    }
}
float3 creaturePoint(uint shape,float u,float v,uint part,constant float4x4 *palette) {
    float3 p=creatureRest(shape,u,v,part);uint3 indices;float3 weights;creatureWeights(shape,part,v,p,indices,weights);
    float3 out=float3(0);for(uint j=0;j<3;j++){if(weights[j]!=0)out+=weights[j]*(palette[indices[j]]*float4(p,1)).xyz;}return out;
}
Frame creatureEllipsoidFrame(float u,float v,float3 center,float3 radius) {
    float a=u*TAU,h=1-2*v,r=sqrt(max(0.0,1-h*h)),c=cos(a),s=sin(a);
    Frame f={creatureEllipsoid(u,v,center,radius),radius*float3(-r*s,0,r*c)*TAU,radius*float3(2*h/r*c,-2,2*h/r*s)};return f;
}
Frame creatureTriangleFrame(float u,float v,float2 a,float2 b,float2 c,float z) {
    const float2 points[3]={a,b,c};float q=fract(u)*3;uint i=uint(floor(q));float f=q-float(i),r=sqrt(v);
    float2 center=(a+b+c)/3,edge=points[i]+(points[(i+1)%3]-points[i])*f,slope=(points[(i+1)%3]-points[i])*3;
    // Match the original central-u chart across triangle seams, h=1e-5.
    const float h=.00001,scaled=3*h;
    if(f<scaled){float2 before=(points[i]-points[(i+2)%3])*3;float blend=(f+scaled)/(2*scaled);slope=mix(before,slope,blend);}
    else if(f>1-scaled){float2 after=(points[(i+2)%3]-points[(i+1)%3])*3;float blend=(f-(1-scaled))/(2*scaled);slope=mix(slope,after,blend);}
    Frame out={creatureTriangle(u,v,a,b,c,z),float3(slope*r,0),float3((edge-center)/(2*r),0)};return out;
}
Frame creatureRestFrame(uint shape,float u,float v,uint part) {
    float a=u*TAU,c=cos(a),s=sin(a),b=M_PI_F*v;part%=64;Frame f;
    if(shape==13) {
        if(part<45)return creatureEllipsoidFrame(u,v,float3(.1,0,0),float3(.94,.45,.29));
        if(part<58)return creatureTriangleFrame(u,v,float2(-.68,0),float2(-1.36,.64),float2(-1.36,-.64),part%2?.055:-.055);
        float absDerivative=-s*(c>=0?1.0:-1.0)*TAU;
        if(abs(c)<TAU*.00001)absDerivative=(abs(cos(a+TAU*.00001))-abs(cos(a-TAU*.00001)))/.00002;
        f={creatureRest(shape,u,v,part),float3(0,.43*sin(b)*absDerivative,.065*c*sin(b)*TAU),float3(-.65,.43*cos(b)*abs(c)*M_PI_F,.065*s*cos(b)*M_PI_F)};return f;
    }
    if(shape==14) {
        if(part<16)return creatureEllipsoidFrame(u,v,float3(0,-.03,0),float3(.27,.58,.25));
        if(part<24)return creatureEllipsoidFrame(u,v,float3(0,.61,0),float3(.23,.25,.23));
        if(part<28){f={creatureRest(shape,u,v,part),float3(-.075*s*(1-v),.075*c*(1-v),0)*TAU,float3(-.075*c,-.075*s,.31)};return f;}
        if(part>=58)return creatureTriangleFrame(u,v,float2(-.19,-.49),float2(.19,-.49),float2(0,-1.01),part%2?.047:-.047);
        f=creatureTriangleFrame(u,v,float2(.18,.23),float2(1.42,.52),float2(.55,-.25),.05*sin(a));
        float side=part%2?1.0:-1.0;f.p.x*=side;f.u.x*=side;f.v.x*=side;f.u.z=.05*cos(a)*TAU;return f;
    }
    if(part>=58)return creatureEllipsoidFrame(u,v,float3(.49,1.14,.08),float3(.28,.20,.23));
    float q=v*TAU*1.3,r=.115+.035*(1-v);
    f={creatureRest(shape,u,v,part),float3(-r*s,0,r*c)*TAU,float3(-.51*sin(q)*TAU*1.3-.035*c,-2.3,.18*cos(q)*TAU*1.3-.035*s)};return f;
}
float creatureSmoothDerivative(float x) {if(x<=0 || x>=1)return 0;return 6*x*(1-x);}
Frame creaturePointFrame(uint shape,float u,float v,uint part,constant float4x4 *palette) {
    Frame rest=creatureRestFrame(shape,u,v,part);uint3 indices;float3 weights;creatureWeights(shape,part,v,rest.p,indices,weights);
    float3 wu=float3(0),wv=float3(0);
    if(shape==13) {
        const float anchors[4]={.35,-.20,-.68,-1.18};uint i=rest.p.x>=-.20?0:rest.p.x>=-.68?1:2;
        float d=anchors[i]-anchors[i+1],derivative=-creatureSmoothDerivative((anchors[i]-rest.p.x)/d)/d;
        wu=float3(-1,1,0)*(derivative*rest.u.x);wv=float3(-1,1,0)*(derivative*rest.v.x);
    } else if(shape==14) {
        if(part>=58){float derivative=-creatureSmoothDerivative((-rest.p.y-.42)/.25)/.25;wu=float3(-1,1,0)*(derivative*rest.u.y);wv=float3(-1,1,0)*(derivative*rest.v.y);}
        else if(part>=28){float d=abs(rest.p.x),sign=rest.p.x>=0?1.0:-1.0,a=creatureSmooth((d-.13)/.30),tip=creatureSmooth((d-.64)/.45),ap=creatureSmoothDerivative((d-.13)/.30)/.30*sign,tp=creatureSmoothDerivative((d-.64)/.45)/.45*sign;float3 derivative=float3(-ap,ap*(1-tip)-a*tp,ap*tip+a*tp);wu=derivative*rest.u.x;wv=derivative*rest.v.x;}
    } else if(part<58 && v>0 && v<1) {float at=v*8;uint i=min(7u,uint(floor(at)));wv=float3(-1,1,0)*(8*creatureSmoothDerivative(at-float(i)));}
    Frame f={creaturePoint(shape,u,v,part,palette),float3(0),float3(0)};
    for(uint j=0;j<3;j++){float3 posed=(palette[indices[j]]*float4(rest.p,1)).xyz;f.u+=weights[j]*(palette[indices[j]]*float4(rest.u,0)).xyz+wu[j]*posed;f.v+=weights[j]*(palette[indices[j]]*float4(rest.v,0)).xyz+wv[j]*posed;}
    if(length_squared(f.u)<1e-18)f.u=float3(1,0,0);if(length_squared(f.v)<1e-18)f.v=float3(0,1,0);return f;
}
Frame creatureFrame(uint shape,float2 ab,uint id,float4 phase,constant float4x4 *palette) {
    float u=fract(ab.x+phase.x+.045*sin(ab.y*TAU+phase.y));
    float v=clamp(ab.y+.055*sin(M_PI_F*ab.y)*sin(ab.x*TAU+phase.z),.00001,.99999);
    return creaturePointFrame(shape,u,v,id%64,palette);
}

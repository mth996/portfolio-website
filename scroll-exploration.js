(() => {
  const body=document.body;
  const canvas=document.getElementById("world-atmosphere");
  const ctx=canvas&&canvas.getContext?canvas.getContext("2d",{alpha:true}):null;
  if(!body||!ctx)return;
  const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse=window.matchMedia("(hover:none), (pointer:coarse)").matches;
  const cue=document.querySelector(".scroll-instruction");
  const cueLabel=document.querySelector(".scroll-cue__label");
  if(cueLabel)cueLabel.textContent=coarse?"SWIPE TO EXPLORE":"SCROLL TO EXPLORE";
  let width=0,height=0,dpr=1,raf=0,scrollY=window.scrollY;
  const stars=Array.from({length:72},()=>({x:Math.random(),y:Math.random(),r:.35+Math.random()*1.15,p:Math.random()*6.28}));
  const portals=[
    ...[...document.querySelectorAll(".project-scene")].map((el,i)=>({el,hue:[190,273,39,187,314,28,166,276,215,192,42][i]||194,label:String(i+1).padStart(2,"0")})),
    {el:document.querySelector("#profile"),hue:179,label:"PROFILE"},
    {el:document.querySelector("#experience"),hue:218,label:"CAREER"},
    {el:document.querySelector("#papers"),hue:302,label:"RESEARCH"},
    {el:document.querySelector("#contact"),hue:192,label:"CONTACT"}
  ].filter(item=>item.el);
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  function resize(){
    width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,1.25);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);draw(0);
  }
  function roundedRect(x,y,w,h,r){
    const rr=Math.min(r,w/2,h/2);
    ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();
  }
  function drawPortal(gate,index,time){
    const rect=gate.el.getBoundingClientRect(),distance=rect.top+scrollY-height*.54;
    if(distance<-height*.46||distance>height*2.25)return;
    const depth=Math.max(.12,distance/height);
    const factor=Math.max(.56,Math.min(1.48,1/(.38+depth*.44)));
    const w=Math.min(width*.38,142*factor),h=Math.min(height*.62,226*factor);
    const side=index%2===0?1:-1;
    const x=width*(side>0?.83:.17);
    const y=height*(.45+.19/(1+depth*.5));
    const alpha=Math.max(.08,Math.min(.42,.43-depth*.12));
    ctx.save();ctx.globalAlpha=alpha;
    ctx.shadowBlur=22*factor;ctx.shadowColor="hsla("+gate.hue+",95%,67%,.75)";
    const gradient=ctx.createLinearGradient(x-w/2,y-h/2,x+w/2,y+h/2);
    gradient.addColorStop(0,"hsla("+gate.hue+",90%,76%,.95)");
    gradient.addColorStop(.5,"hsla("+(gate.hue+45)+",95%,68%,.72)");
    gradient.addColorStop(1,"hsla("+(gate.hue+90)+",90%,76%,.9)");
    ctx.lineWidth=Math.max(1.3,2.2*factor);ctx.strokeStyle=gradient;
    roundedRect(x-w/2,y-h/2,w,h,Math.min(36,w*.28));ctx.stroke();
    ctx.shadowBlur=0;ctx.globalAlpha=alpha*.36;
    roundedRect(x-w*.36,y-h*.43,w*.72,h*.86,Math.min(28,w*.2));
    ctx.fillStyle="hsla("+gate.hue+",90%,62%,.19)";ctx.fill();
    ctx.globalAlpha=alpha*.92;ctx.fillStyle="rgba(226,241,255,.82)";
    ctx.font="700 "+Math.max(8,Math.min(11,9*factor))+"px Arial";
    ctx.textAlign="center";ctx.fillText(gate.label,x,y+h/2+14*factor);
    const shimmer=(time*.0004+index*.37)%1;
    ctx.globalAlpha=alpha*.52;ctx.strokeStyle="rgba(255,255,255,.7)";ctx.lineWidth=1;
    const sweepY=y-h/2+shimmer*h;
    ctx.beginPath();ctx.moveTo(x-w*.32,sweepY);ctx.lineTo(x+w*.32,sweepY);ctx.stroke();
    ctx.restore();
  }
  function drawDrone(time){
    const travel=scrollY/Math.max(1,height);
    const x=width*(.5+Math.sin(travel*.7)*.1), y=height*(.78+Math.sin(time*.0017)*.012);
    ctx.save();ctx.translate(x,y);ctx.globalAlpha=.72;
    ctx.shadowColor="#80eaff";ctx.shadowBlur=20;
    ctx.strokeStyle="rgba(128,234,255,.68)";ctx.lineWidth=1.2;
    ctx.beginPath();ctx.ellipse(0,0,21,8,0,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="rgba(9,20,37,.86)";roundedRect(-10,-9,20,18,7);ctx.fill();
    ctx.strokeStyle="rgba(180,246,255,.8)";ctx.stroke();
    ctx.shadowBlur=12;ctx.fillStyle="#a6f5ff";
    ctx.beginPath();ctx.arc(0,0,3.1,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle="rgba(183,226,255,.68)";
    ctx.beginPath();ctx.arc(-6,-3,1.2,0,Math.PI*2);ctx.arc(6,-3,1.2,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function draw(time){
    if(!width||!height)return;
    ctx.clearRect(0,0,width,height);
    const hue=Number(getComputedStyle(document.documentElement).getPropertyValue("--world-hue"))||194;
    const horizon=height*.47,center=width*.5;
    const sky=ctx.createLinearGradient(0,0,0,height);
    sky.addColorStop(0,"rgba(8,12,29,.08)");sky.addColorStop(.48,"hsla("+hue+",68%,31%,.09)");
    sky.addColorStop(1,"rgba(5,8,18,.23)");ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    for(const star of stars){
      const drift=reduce?0:Math.sin(time*.00025+star.p)*4;
      const sy=((star.y*height-scrollY*.045*star.p)%height+height)%height;
      ctx.globalAlpha=.16+(Math.sin(time*.001+star.p)+1)*.12;
      ctx.fillStyle="hsla("+hue+",95%,84%,.9)";
      ctx.beginPath();ctx.arc(star.x*width+drift,sy,star.r,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    const glow=ctx.createRadialGradient(center,horizon,5,center,horizon,width*.48);
    glow.addColorStop(0,"hsla("+hue+",94%,70%,.18)");glow.addColorStop(1,"hsla("+hue+",90%,52%,0)");
    ctx.fillStyle=glow;ctx.fillRect(0,horizon-height*.2,width,height*.5);
    ctx.beginPath();ctx.moveTo(center-width*.055,horizon);ctx.lineTo(center+width*.055,horizon);
    ctx.lineTo(width*.72,height);ctx.lineTo(width*.28,height);ctx.closePath();
    const road=ctx.createLinearGradient(0,horizon,0,height);
    road.addColorStop(0,"rgba(52,105,148,.015)");road.addColorStop(1,"rgba(50,92,145,.11)");
    ctx.fillStyle=road;ctx.fill();
    ctx.strokeStyle="hsla("+hue+",90%,73%,.2)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(center-width*.055,horizon);ctx.lineTo(width*.28,height);
    ctx.moveTo(center+width*.055,horizon);ctx.lineTo(width*.72,height);ctx.stroke();
    for(let lane=-3;lane<=3;lane++){
      const bottomX=center+lane*width*.095;
      ctx.strokeStyle="hsla("+(hue+28)+",88%,72%,"+(lane===0?.15:.07)+")";
      ctx.beginPath();ctx.moveTo(center+lane*width*.008,horizon);ctx.lineTo(bottomX,height);ctx.stroke();
    }
    const phase=reduce?0:(scrollY*.0018+time*.00004)%1;
    for(let i=0;i<13;i++){
      const p=(i/13+phase)%1,y=horizon+Math.pow(p,2.15)*(height-horizon);
      const half=width*.055+p*width*.45;
      ctx.strokeStyle="hsla("+hue+",88%,72%,"+(.025+p*.12)+")";ctx.lineWidth=.7+p*.65;
      ctx.beginPath();ctx.moveTo(center-half,y);ctx.lineTo(center+half,y);ctx.stroke();
    }
    portals.forEach((gate,index)=>drawPortal(gate,index,time));
    drawDrone(time);
    ctx.globalAlpha=1;
  }
  function animate(time){draw(time);if(!reduce&&!document.hidden)raf=requestAnimationFrame(animate)}
  window.addEventListener("scroll",()=>{scrollY=window.scrollY;if(!raf)raf=requestAnimationFrame(animate)},{passive:true});
  window.addEventListener("resize",resize,{passive:true});
  document.addEventListener("visibilitychange",()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else if(!reduce&&!raf)raf=requestAnimationFrame(animate)});
  if(cue){
    const dismiss=()=>{if(scrollY>12)body.classList.add("is-exploring")};
    window.addEventListener("scroll",dismiss,{passive:true,once:true});
  }
  scrollY=window.scrollY;resize();
  if(!reduce)raf=requestAnimationFrame(animate);
})();
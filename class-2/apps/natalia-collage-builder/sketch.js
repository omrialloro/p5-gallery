// Cutout Studio — p5.js instance mode. All processing stays in the browser.
const $=id=>document.getElementById(id);
let sourcePhoto, selection=null, cutter='Ellipse', brushes=[], activeBrush=-1, sourceP, drawP, ink, history=[], drawing=false, lastPoint=null, mode='paint';
const W=700,H=540, SW=600,SH=460;
function status(text){$('status').textContent=text;}
function shapePath(ctx,s){const x=Math.min(s.a.x,s.b.x),y=Math.min(s.a.y,s.b.y),w=Math.abs(s.b.x-s.a.x),h=Math.abs(s.b.y-s.a.y);ctx.beginPath();if(s.type==='Freehand'){s.points.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y));}else if(s.type==='Ellipse'){ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);}else if(s.type==='Rectangle'){ctx.rect(x,y,w,h);}else{let n=s.type==='Triangle'?3:10;for(let i=0;i<n;i++){let r=s.type==='Star'&&i%2?.43:1;let t=-Math.PI/2+i*Math.PI*2/n;let px=x+w/2+Math.cos(t)*w/2*r,py=y+h/2+Math.sin(t)*h/2*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}}ctx.closePath();}
function bounds(s){let pts=s.type==='Freehand'?s.points:[s.a,s.b];return{x:Math.min(...pts.map(p=>p.x)),y:Math.min(...pts.map(p=>p.y)),w:Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x)),h:Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y))};}
['Ellipse','Rectangle','Triangle','Star','Freehand'].forEach(name=>{let b=document.createElement('button');b.textContent=name;b.classList.toggle('active',name===cutter);b.onclick=()=>{cutter=name;selection=null;$('cut').disabled=true;[...$('cutters').children].forEach(el=>el.classList.toggle('active',el===b));$('cutHint').textContent=name==='Freehand'?'Trace a piece of the photo. Release to close it, then drag inside to reposition.':'Drag to select a shape. Drag inside the selection to reposition it before making your brush.';};$('cutters').appendChild(b);});
new p5(p=>{sourceP=p;let drag=false, moving=false, dragStart=null, originalSelection=null;p.setup=()=>{p.pixelDensity(1);p.createCanvas(SW,SH).parent('source');sourcePhoto=p.createGraphics(SW,SH);sourcePhoto.background('#c6d5d0');sourcePhoto.noStroke();sourcePhoto.fill('#637f75');sourcePhoto.ellipse(80,470,500,420);sourcePhoto.fill('#d8b98b');sourcePhoto.rect(310,0,290,460);sourcePhoto.fill('#ef805a');sourcePhoto.ellipse(382,180,235,235);sourcePhoto.fill('#f9cf73');sourcePhoto.ellipse(372,165,155,155);sourcePhoto.fill('#f4ede0');sourcePhoto.rect(100,140,135,250,65,65,20,20);sourcePhoto.fill('#3b5946');for(let i=0;i<7;i++){sourcePhoto.push();sourcePhoto.translate(162,160-i*15);sourcePhoto.rotate(i%2?-.7:.7);sourcePhoto.ellipse(0,-40,25,95);sourcePhoto.pop();}sourcePhoto.stroke('#324b3b');sourcePhoto.strokeWeight(5);sourcePhoto.line(162,100,162,270);};p.draw=()=>{p.image(sourcePhoto,0,0);if(selection){let c=p.drawingContext;c.save();shapePath(c,selection);c.fillStyle='rgba(255,255,255,.15)';c.fill();c.strokeStyle='#fff';c.lineWidth=3;c.stroke();c.setLineDash([6,5]);c.strokeStyle='#263a2b';c.lineWidth=1.5;c.stroke();c.restore();}};function pt(){return{x:p.constrain(p.mouseX,0,SW),y:p.constrain(p.mouseY,0,SH)}}function hitSelection(point){
  if(!selection)return false;
  const area=bounds(selection);
  if(area.w<5||area.h<5)return false;
  const ctx=p.drawingContext;
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  shapePath(ctx,selection);
  const hit=ctx.isPointInPath(point.x,point.y);
  ctx.restore();
  return hit;
}
p.mouseMoved=()=>{
  p.canvas.style.cursor=hitSelection(pt())?'grab':'crosshair';
};
p.mousePressed=()=>{
  if(p.mouseX<0||p.mouseX>SW||p.mouseY<0||p.mouseY>SH)return;
  const point=pt();
  drag=true;
  moving=hitSelection(point);
  if(moving){
    dragStart=point;
    originalSelection={type:selection.type,a:{...selection.a},b:{...selection.b},points:selection.points.map(v=>({...v}))};
    p.canvas.style.cursor='grabbing';
  }else{
    selection={type:cutter,a:point,b:point,points:[point]};
    $('cut').disabled=true;
  }
  return false;
};
p.mouseDragged=()=>{
  if(!drag||!selection)return;
  const point=pt();
  if(moving){
    const area=bounds(originalSelection);
    const dx=p.constrain(point.x-dragStart.x,-area.x,SW-area.x-area.w);
    const dy=p.constrain(point.y-dragStart.y,-area.y,SH-area.y-area.h);
    const shift=v=>({x:v.x+dx,y:v.y+dy});
    selection={type:originalSelection.type,a:shift(originalSelection.a),b:shift(originalSelection.b),points:originalSelection.points.map(shift)};
  }else{
    selection.b=point;
    if(selection.type==='Freehand')selection.points.push(point);
  }
  return false;
};
p.mouseReleased=()=>{
  if(!drag)return;
  drag=false;moving=false;dragStart=null;originalSelection=null;
  p.canvas.style.cursor=hitSelection(pt())?'grab':'crosshair';
  if(!selection)return;
  const area=bounds(selection);
  $('cut').disabled=area.w<5||area.h<5||(selection.type==='Freehand'&&selection.points.length<3);
  if(!$('cut').disabled)status('Drag inside the selection to move it, then click Make brush. Drag outside to select a new piece.');
};
});

$('file').onchange=e=>{const f=e.target.files[0];if(!f)return;status('Opening photo…');let url=URL.createObjectURL(f);sourceP.loadImage(url,img=>{let scale=Math.min(1600/img.width,1600/img.height,1);img.resize(Math.round(img.width*scale),Math.round(img.height*scale));let g=sourceP.createGraphics(SW,SH);g.pixelDensity(1);g.background('#e6e7df');let r=Math.min(SW/img.width,SH/img.height);g.image(img,(SW-img.width*r)/2,(SH-img.height*r)/2,img.width*r,img.height*r);if(sourcePhoto.remove)sourcePhoto.remove();sourcePhoto=g;selection=null;$('cut').disabled=true;URL.revokeObjectURL(url);status('Photo ready. Drag a cutter over the part you want.');},()=>{URL.revokeObjectURL(url);status('Could not open that image. Try a JPG or PNG.');});};
$('resetSelection').onclick=()=>{selection=null;$('cut').disabled=true;};
$('cut').onclick=()=>{if(!selection)return;const b=bounds(selection);if(b.w<5||b.h<5)return;const g=sourceP.createGraphics(Math.ceil(b.w),Math.ceil(b.h));g.pixelDensity(1);let c=g.drawingContext;c.save();c.translate(-b.x,-b.y);shapePath(c,selection);c.clip();c.drawImage(sourcePhoto.canvas,0,0);c.restore();let img=g.get();g.remove();brushes.push(img);activeBrush=brushes.length-1;renderShelf();status('Brush created! Click or drag on your composition to paint.');};
function renderShelf(){$('shelf').innerHTML='';brushes.forEach((img,i)=>{let b=document.createElement('button');b.className=i===activeBrush?'active':'';b.title='Use brush '+(i+1);b.setAttribute('aria-label',b.title);let el=document.createElement('img');el.src=img.canvas.toDataURL();el.alt='Cutout '+(i+1);b.appendChild(el);b.onclick=()=>{activeBrush=i;renderShelf();};$('shelf').appendChild(b);});$('count').textContent=brushes.length+' brush'+(brushes.length===1?'':'es');}
function checkpoint(){history.push(ink.get());if(history.length>20)history.shift();$('undo').disabled=false;}
function stamp(x,y){if(activeBrush<0)return;const img=brushes[activeBrush],size=+$('size').value;ink.push();ink.translate(x,y);ink.rotate(+$('rotation').value*Math.PI/180);ink.imageMode(drawP.CENTER);ink.image(img,0,0,size*img.width/Math.max(img.width,img.height),size*img.height/Math.max(img.width,img.height));ink.pop();}
new p5(p=>{drawP=p;p.setup=()=>{p.pixelDensity(1);p.createCanvas(W,H).parent('drawing');ink=p.createGraphics(W,H);ink.pixelDensity(1);};p.draw=()=>{p.background($('paper').value);p.image(ink,0,0);if(activeBrush<0){p.noStroke();p.fill('#89917e');p.textAlign(p.CENTER);p.textSize(17);p.text('Your next collage starts here.',W/2,H/2-8);p.textSize(12);p.text('Cut a brush from the photo to begin.',W/2,H/2+17);}if(activeBrush>=0&&p.mouseX>=0&&p.mouseX<W&&p.mouseY>=0&&p.mouseY<H){let img=brushes[activeBrush],sz=+$('size').value;p.push();p.translate(p.mouseX,p.mouseY);p.rotate(+$('rotation').value*Math.PI/180);p.imageMode(p.CENTER);p.tint(255,100);p.image(img,0,0,sz*img.width/Math.max(img.width,img.height),sz*img.height/Math.max(img.width,img.height));p.pop();}};p.mousePressed=()=>{if(p.mouseX<0||p.mouseX>W||p.mouseY<0||p.mouseY>H)return;if(activeBrush<0){status('First make a brush using the photo on the left.');return;}checkpoint();drawing=true;lastPoint={x:p.mouseX,y:p.mouseY};stamp(p.mouseX,p.mouseY);};p.mouseDragged=()=>{if(!drawing||mode==='stamp')return;if(p.mouseX<0||p.mouseX>W||p.mouseY<0||p.mouseY>H){lastPoint=null;return;}if(!lastPoint){lastPoint={x:p.mouseX,y:p.mouseY};stamp(p.mouseX,p.mouseY);return false;}const dx=p.mouseX-lastPoint.x,dy=p.mouseY-lastPoint.y,d=Math.hypot(dx,dy),step=Math.max(2,+$('size').value*0.3);if(d>=step){let n=Math.floor(d/step),start={...lastPoint};for(let i=1;i<=n;i++)stamp(start.x+dx/d*i*step,start.y+dy/d*i*step);lastPoint={x:start.x+dx/d*n*step,y:start.y+dy/d*n*step};}return false;};p.mouseReleased=()=>{drawing=false;lastPoint=null;};});
['size','rotation'].forEach(id=>{$(id).oninput=()=>$(id+'Value').textContent=$(id).value+(id==='size'?' px':id==='rotation'?'°':'%');});
$('paintMode').onclick=()=>setMode('paint');$('stampMode').onclick=()=>setMode('stamp');function setMode(m){mode=m;$('paintMode').classList.toggle('active',m==='paint');$('stampMode').classList.toggle('active',m==='stamp');}
$('undo').onclick=()=>{if(!history.length)return;ink.clear();ink.image(history.pop(),0,0);$('undo').disabled=!history.length;};$('clear').onclick=()=>{checkpoint();ink.clear();status('Canvas cleared. Undo restores your previous composition.');};$('save').onclick=()=>{let out=drawP.createGraphics(W,H);out.pixelDensity(1);out.background($('paper').value);out.image(ink,0,0);drawP.saveCanvas(out.canvas,'cutout-composition','png');out.remove();status('Composition downloaded as PNG.');};

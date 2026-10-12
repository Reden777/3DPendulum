import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d-compat';
import './style.css';

const $ = (id) => document.getElementById(id);
const config = { length: 1.8, mass: .085, drag: .18, wind: 0, entropy: false };
let world, bob, pivot, ropeLength = config.length, released = false, reading = false;
let scene, camera, renderer, controls, bobMesh, cord, halo, clock;
let entropySeed = Math.random();

await RAPIER.init();
init();

function init() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x080d13, .08);
  camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 100);
  camera.position.set(4.2, 2.7, 5.2);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('canvas').append(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, -.45, 0); controls.enableDamping = true; controls.minDistance = 3; controls.maxDistance = 9;
  scene.add(new THREE.HemisphereLight(0x9ec6db, 0x080b0e, 2.4));
  const key = new THREE.DirectionalLight(0xd6e7e8, 3); key.position.set(-3, 5, 3); key.castShadow = true; scene.add(key);
  const warm = new THREE.PointLight(0xffa664, 12, 8); warm.position.set(1.5, .3, 1.5); scene.add(warm);
  makeEnvironment(); makePendulum(); createPhysics(); bindUI();
  clock = new THREE.Clock(); animate();
}

function makeEnvironment() {
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4.6, 96), new THREE.MeshStandardMaterial({ color: 0x101a20, roughness: .92, metalness: .12 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2.15; floor.receiveShadow = true; scene.add(floor);
  const rings = new THREE.Group();
  [1, 2, 3, 4].forEach(r => { const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length: 96}, (_, i) => new THREE.Vector3(Math.cos(i/96*Math.PI*2)*r, -2.14, Math.sin(i/96*Math.PI*2)*r))), new THREE.LineBasicMaterial({color:0x31515c, transparent:true, opacity:.35})); rings.add(line); }); scene.add(rings);
  const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({color:0xd7f1ed, size:.018, transparent:true, opacity:.45}));
  const pts = []; for(let i=0;i<300;i++) pts.push((Math.random()-.5)*12, Math.random()*7-2, (Math.random()-.5)*12); stars.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts,3)); scene.add(stars);
}

function makePendulum() {
  pivot = new THREE.Vector3(0, 1.8, 0);
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(.14,.19,.16,24), new THREE.MeshStandardMaterial({color:0xb68e56, metalness:.8, roughness:.24})); mount.position.copy(pivot); scene.add(mount);
  const top = new THREE.Mesh(new THREE.SphereGeometry(.11, 24, 16), new THREE.MeshStandardMaterial({color:0xd8b56f, metalness:.9, roughness:.18})); top.position.copy(pivot); scene.add(top);
  bobMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(.24, 4), new THREE.MeshPhysicalMaterial({color:0x7bd0c9, metalness:.72, roughness:.16, clearcoat:1, clearcoatRoughness:.1, emissive:0x07352f, emissiveIntensity:.35})); bobMesh.castShadow = true; scene.add(bobMesh);
  halo = new THREE.Mesh(new THREE.RingGeometry(.31,.325,64), new THREE.MeshBasicMaterial({color:0x9ef1db, transparent:true, opacity:.45, side:THREE.DoubleSide})); halo.rotation.x = -Math.PI/2; scene.add(halo);
  cord = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pivot, new THREE.Vector3(0,0,0)]), new THREE.LineBasicMaterial({color:0xe7d5ad})); scene.add(cord);
}

function createPhysics() {
  world = new RAPIER.World({x:0,y:-9.81,z:0});
  const body = RAPIER.RigidBodyDesc.dynamic().setTranslation(.52, pivot.y - Math.sqrt(ropeLength*ropeLength-.52*.52), 0).setLinearDamping(0).setAngularDamping(.55).setAdditionalMass(config.mass);
  bob = world.createRigidBody(body); world.createCollider(RAPIER.ColliderDesc.ball(.24).setDensity(1), bob);
}

function constrainBob(dt) {
  const p = bob.translation(), v = bob.linvel(); const pos = new THREE.Vector3(p.x,p.y,p.z); const vel = new THREE.Vector3(v.x,v.y,v.z);
  const r = pos.clone().sub(pivot), dist = r.length(), n = r.normalize();
  const radialVelocity = vel.dot(n); const stretch = dist - ropeLength;
  // spring constraint maintains a taut cord without hiding real motion
  const tension = -(stretch * 420 + radialVelocity * 28); bob.addForce({x:n.x*tension,y:n.y*tension,z:n.z*tension}, true);
  const wind = new THREE.Vector3(config.wind * (0.65 + .35 * Math.sin(performance.now()/1100 + entropySeed*10)), 0, config.wind*.26);
  const relative = vel.clone().sub(wind); const speed = relative.length();
  const dragForce = relative.multiplyScalar(-config.drag * speed * 1.7); bob.addForce(dragForce, true);
  if (released) { const flutter = .035 + config.wind*.04; bob.addForce({x:(Math.random()-.5)*flutter,y:0,z:(Math.random()-.5)*flutter}, true); }
}

function animate() { requestAnimationFrame(animate); const dt = Math.min(clock.getDelta(), .033); constrainBob(dt); world.timestep = dt; world.step();
  const p=bob.translation(); bobMesh.position.set(p.x,p.y,p.z); bobMesh.rotation.x += dt*1.3; bobMesh.rotation.z += dt*.8; halo.position.set(p.x,-2.13,p.z); halo.scale.setScalar(1+Math.max(0, bob.linvel().y)*.02); halo.material.opacity=.18+Math.min(.35, Math.abs(bob.linvel().x)*.07);
  cord.geometry.setFromPoints([pivot, bobMesh.position]); controls.update(); renderer.render(scene,camera);
  if(reading && performance.now()-reading > 6200) settleReading();
}

function bindUI() {
  [['length','length-out',v=>`${(+v).toFixed(1)} m`],['mass','mass-out',v=>`${v} g`],['drag','drag-out',v=>+v.toFixed(2)],['wind','wind-out',v=>`${(+v).toFixed(1)} m/s`]].forEach(([id,out,fmt]) => $(id).addEventListener('input', e => { $(out).value=fmt(+e.target.value); config[id]=id==='mass'?+e.target.value/1000:+e.target.value; if(id==='length') ropeLength=config.length; }));
  $('release').addEventListener('click', release); $('reset').addEventListener('click', reset);
  $('randomorg').addEventListener('change', async e => { config.entropy=e.target.checked; $('entropy-label').textContent=e.target.checked?'Fetching random.org…':'Local system noise'; if(e.target.checked){ try { const t=await fetch('https://www.random.org/integers/?num=1&min=1&max=999999&col=1&base=10&format=plain&rnd=new'); entropySeed=(parseInt(await t.text(),10)||Math.random())/999999; $('entropy-label').textContent='random.org atmospheric noise'; }catch{ $('entropy-label').textContent='Fallback local system noise'; } }});
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
}

function release() { if(reading) return; const q=$('question').value.trim(); released=true; reading=performance.now(); const a=Math.random()*Math.PI*2, impulse=.65+Math.random()*.45; bob.applyImpulse({x:Math.cos(a)*impulse,y:0,z:Math.sin(a)*impulse},true); $('release').textContent='Reading in motion…'; $('state').textContent='INTERPRETING MOTION'; $('answer').textContent='•••'; $('detail').textContent=q ? `Listening to: “${q}”` : 'The pendulum is finding its path.'; }
function settleReading(){ const v=bob.linvel(), angle=Math.atan2(v.x,v.z); const options=['YES','NO','UNCLEAR','ASK AGAIN']; const index=Math.abs(Math.floor((angle+entropySeed*13)*2.7))%options.length; $('answer').textContent=options[index]; $('detail').textContent=options[index]==='YES'?'The movement settles with an open current.':options[index]==='NO'?'The motion closes toward a boundary.':'The field remains unsettled — return when clear.'; $('state').textContent='READING COMPLETE'; $('release').innerHTML='Release again <span>→</span>'; reading=false; }
function reset(){ bob.setTranslation({x:.52,y:pivot.y-Math.sqrt(ropeLength*ropeLength-.52*.52),z:0},true); bob.setLinvel({x:0,y:0,z:0},true); released=false; reading=false; $('answer').textContent='—'; $('detail').textContent='Set your question, then release the pendulum.'; $('state').textContent='AWAITING INTENTION'; $('release').innerHTML='Release pendulum <span>→</span>'; }

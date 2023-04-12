import * as THREE from "three";
import GUI from "lil-gui";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import Stats from "three/examples/jsm/libs/stats.module.js";

import Cloud from "./Cloud";

let stats = new Stats();
document.body.appendChild(stats.dom);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(70);
camera.position.set(-4.0, -5.5, 8.0);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
//controls.autoRotate = true;

let params = {
  skyColor: 0x337fff,
  cloudColor: 0xeabf6b,
  uniformPixels: true,
  lastTouchedPixelID: 0,
};

let cloud = new Cloud(camera, {
  cloudSize: new THREE.Vector3(0.5, 1.0, 0.5),
  sunPosition: new THREE.Vector3(1.0, 2.0, 1.0),
  cloudColor: new THREE.Color(params.cloudColor), //"rgb(234, 191, 107)"
  //cloudColor: new THREE.Color("rgb(234, 191, 107)"),
  skyColor: new THREE.Color(params.skyColor), //"rgb(51, 127, 255)"
  //skyColor: new THREE.Color("rgb(51, 127, 255)"),
  cloudSteps: 48,
  shadowSteps: 16, // orig: 8, but too noisy
  cloudLength: 16,
  shadowLength: 4, // orig: 2, but too dark
  noise: false,
  turbulence: 0.05,
  shift: true,
  pixelWidth: 1,
  pixelHeight: 1,
});

let composer = new EffectComposer(renderer);
composer.addPass(cloud);

let gui = new GUI();
gui.add(cloud, "shift");
gui.add(cloud, "noise");
gui.add(cloud, "turbulence").min(0).max(2).step(0.01);
gui.addColor(params, "skyColor").onChange((value) => {
  cloud.skyColor = new THREE.Color(value);
});
gui.addColor(params, "cloudColor").onChange((value) => {
  cloud.cloudColor = new THREE.Color(value);
});
gui
  .add(cloud, "pixelWidth")
  .min(1)
  .max(64)
  .step(1)
  .listen()
  .onChange(() => {
    params.lastTouchedPixelID = 0;
    if (params.uniformPixels) {
      cloud.pixelHeight = cloud.pixelWidth;
    }
  });

gui
  .add(cloud, "pixelHeight")
  .min(1)
  .max(64)
  .step(1)
  .listen()
  .onChange(() => {
    params.lastTouchedPixelID = 1;
    if (params.uniformPixels) {
      cloud.pixelWidth = cloud.pixelHeight;
    }
  });
gui.add(params, "uniformPixels").onChange((value) => {
  if (value) {
    const sizes = [cloud.pixelWidth, cloud.pixelHeight];
    //console.log("max size:" + size);
    cloud.pixelWidth = sizes[params.lastTouchedPixelID];
    cloud.pixelHeight = sizes[params.lastTouchedPixelID];
  }
});

/*
params = { pixelSize: 6, normalEdgeStrength: .3, depthEdgeStrength: .4, pixelAlignedPanning: true };
gui.add( params, 'pixelSize' ).min( 1 ).max( 16 ).step( 1 )
  .onChange( () => {

    renderPixelatedPass.setPixelSize( params.pixelSize );

  } );
gui.add( renderPixelatedPass, 'normalEdgeStrength' ).min( 0 ).max( 2 ).step( .05 );
gui.add( renderPixelatedPass, 'depthEdgeStrength' ).min( 0 ).max( 1 ).step( .05 );
gui.add( params, 'pixelAlignedPanning' );
*/

const handleResize = () => {
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(dpr);
  composer.setSize(window.innerWidth, window.innerHeight);
  cloud.setSize(window.innerWidth * dpr, window.innerHeight * dpr);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  if (!cloud.isAnimated()) {
    render();
  }
};
handleResize();
window.addEventListener("resize", handleResize);

let lastPolarAngle = 0;
let lastAzimuthalAngle = 0;

controls.addEventListener("change", () => {
  const polarAngle = controls.getPolarAngle();
  const azimuthalAngle = controls.getAzimuthalAngle();

  const rotationDelta =
    Math.abs(polarAngle - lastPolarAngle) +
    Math.abs(azimuthalAngle - lastAzimuthalAngle);
  cloud.regress = rotationDelta > 0.0002;

  lastPolarAngle = polarAngle;
  lastAzimuthalAngle = azimuthalAngle;

  if (!cloud.isAnimated()) {
    render();
  }
});

console.log("Starting scene...");

renderer.setAnimationLoop((time) => {
  // Note: controls.update() needs to be called after every manual update to the camera position
  // Also required if controls.enableDamping or controls.autoRotate are set to true.
  // See https://threejs.org/docs/?q=orbit#examples/en/controls/OrbitControls
  if (controls.autoRotate || controls.enableDamping) {
    controls.update();
  }

  let timeSeconds = time / 1000.0;
  //console.log("time (s):" + timeSeconds);
  cloud.time = timeSeconds;
  //console.log("animated:" + cloud.isAnimated());
  if (cloud.isAnimated()) {
    render();
  }
});

function render() {
  stats.begin();
  composer.render();
  stats.end();
}

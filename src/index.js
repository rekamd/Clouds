import * as THREE from "three";
import GUI from "lil-gui";

import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import Stats from "three/examples/jsm/libs/stats.module.js";

import Cloud from "./Cloud";
import { Timer } from "./Timer.js";

let tokenTest = false;

class MinMaxProperty {
  constructor(min, max, object, propertyName, floatProperty = true) {
    this.min = min;
    this.max = max;
    this.object = object;
    this.propertyName = propertyName;
    this.floatProperty = floatProperty;

    this.applyBounds();
  }

  get value() {
    return this.object[this.propertyName];
  }

  set value(val) {
    this.object[this.propertyName] = Math.max(
      this.min,
      Math.min(val, this.max),
    );
  }

  applyBounds() {
    let val = this.value;
    this.value = val;
  }

  addGUI(gui, collapsed = true) {
    let propertyGUI = gui.addFolder(this.propertyName);
    if (collapsed) propertyGUI.close();

    let controller = propertyGUI.add(this, "value").min(this.min).max(this.max);

    if (this.floatProperty) controller.step((this.max - this.min) / 255.0);
    else controller.step(1);

    propertyGUI.add(this, "min").onChange((value) => {
      controller.min(value);
      this.applyBounds();
      if (this.floatProperty) controller.step((this.max - this.min) / 255.0);
      controller.updateDisplay();
    });

    propertyGUI.add(this, "max").onChange((value) => {
      controller.max(value);
      this.applyBounds();
      if (this.floatProperty) controller.step((this.max - this.min) / 255.0);
      controller.updateDisplay();
    });
  }
}

// generate token data in the right format as done in the Artblocks template
function genTokenData(projectNum) {
  let data = {};
  let hash = "0x";
  for (var i = 0; i < 64; i++) {
    hash += Math.floor(Math.random() * 16).toString(16);
  }
  data.hash = hash;
  data.tokenId = (
    projectNum * 1000000 +
    Math.floor(Math.random() * 1000)
  ).toString();
  return data;
}
// provide global tokenData variable as in Artblocks environment
let tokenData = genTokenData(99);

// Turn the hash string, containing 64 hexadecimal numbers in sequence, into hash pairs of 2 hexadecimal numbers.
// This means 0xeca4cf6288eb455f388301c28ac01a8da5746781d22101a65cb78a96a49512c8
// turns into ["ec", "a4", "cf", "62", "88", "eb", ...]
const hashPairs = [];
for (let j = 0; j < 32; j++) {
  hashPairs.push(tokenData.hash.slice(2 + j * 2, 4 + j * 2));
}

// convert hash pairs into individual integer hash values ranging from 0 to 255
const hashValuesInt = hashPairs.map((x) => {
  return parseInt(x, 16);
});

// create normalized floating point hash values ranging from 0.0 to 1.0
const hashValuesNorm = [];
for (let j = 0; j < 32; j++) {
  hashValuesNorm.push(hashValuesInt[j] / 255.0);
}

let stats = new Stats();
document.body.appendChild(stats.dom);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
document.body.appendChild(renderer.domElement);

let timer = new Timer();
timer.enableFixedDelta();

let cloudSeed = 83.0;
let sunPositionX = -1.2;
let sunPositionY = 2.1;
let sunPositionZ = -1.0;

// assign random values based on tokenData hash
if (tokenTest) {
  cloudSeed = hashValuesInt[0];
  let maxSunPosXZ = 10.0;
  let minSunPosY = 2.0;
  let maxSunPosY = 10.0;
  sunPositionX = -maxSunPosXZ + 2 * maxSunPosXZ * hashValuesNorm[1];
  sunPositionY = minSunPosY + (maxSunPosY - minSunPosY) * hashValuesNorm[2];
  sunPositionZ = -maxSunPosXZ + 2 * maxSunPosXZ * hashValuesNorm[3];
}

let cloudColor = 0xeabf6b;
let skyColor = 0x337fff;

let cloud = new Cloud(renderer.domElement, {
  cloudSeed: cloudSeed, //83.0,
  cloudSize: new THREE.Vector3(2, 1, 2),
  sunPosition: new THREE.Vector3(sunPositionX, sunPositionY, sunPositionZ),
  cloudColor: new THREE.Color(cloudColor), //"rgb(234, 191, 107)"
  skyColor: new THREE.Color(skyColor), //"rgb(51, 127, 255)"
  pixelWidth: 10,
  pixelHeight: 10,
});

let params = {
  skyColor: skyColor,
  skyColorFade: 0xffffff,
  sunPositionX: sunPositionX, //4.0,
  sunPositionY: sunPositionY, //3.5,
  sunPositionZ: sunPositionZ, //-1.0,
  initialCameraPositionX: cloud.initialCameraPosition.x,
  initialCameraPositionY: cloud.initialCameraPosition.y,
  initialCameraPositionZ: cloud.initialCameraPosition.z,
  cloudColor: cloudColor,
  sunColor: "rgb(255, 153, 25)",
  uniformPixels: true,
  lastTouchedPixelID: 0,
  pause: false,
};

let composer = new EffectComposer(renderer);
composer.addPass(cloud);

let gui = new GUI();
gui.add(params, "pause");

new MinMaxProperty(-100, 100, cloud, "shift").addGUI(gui, false);
new MinMaxProperty(1, 32000, cloud, "cloudSeed").addGUI(gui);
new MinMaxProperty(1, 128, cloud, "cloudCount").addGUI(gui, false);
new MinMaxProperty(0, 5, cloud, "cloudMinimumDensity").addGUI(gui, false);
new MinMaxProperty(0, 5, cloud, "cloudRoughness").addGUI(gui);
new MinMaxProperty(0, 20, cloud, "cloudScatter").addGUI(gui, false);
new MinMaxProperty(-5, 5, cloud, "cloudShape").addGUI(gui);
new MinMaxProperty(0, 5, cloud, "cloudAnimationSpeed").addGUI(gui);
new MinMaxProperty(0, 5, cloud, "cloudAnimationStrength").addGUI(gui);
new MinMaxProperty(0, 1, cloud, "sunIntensity").addGUI(gui);
new MinMaxProperty(-2, 2, cloud, "sunSize").addGUI(gui);
new MinMaxProperty(0, 10, cloud, "skyFadeFactor").addGUI(gui);
new MinMaxProperty(-4, 4, cloud, "skyFadeShift").addGUI(gui);
new MinMaxProperty(-1, 2, cloud, "tileMixFactor").addGUI(gui);
new MinMaxProperty(0, 19, cloud, "skyTileIndex", false).addGUI(gui);
new MinMaxProperty(0, 19, cloud, "cloudTileIndex", false).addGUI(gui);

gui
  .add(params, "sunPositionX")
  .onChange((value) => {
    let sunPos = cloud.sunPosition;
    //console.log("x: " + value);
    sunPos.x = value;
    cloud.sunPosition = sunPos;
    //console.log("sunPosition: " + cloud.sunPosition);
  })
  .min(-10)
  .max(10)
  .step(0.001);
gui
  .add(params, "sunPositionY")
  .onChange((value) => {
    let sunPos = cloud.sunPosition;
    sunPos.y = value;
    cloud.sunPosition = sunPos;
  })
  .min(-10)
  .max(10)
  .step(0.001);
gui
  .add(params, "sunPositionZ")
  .onChange((value) => {
    let sunPos = cloud.sunPosition;
    sunPos.z = value;
    cloud.sunPosition = sunPos;
  })
  .min(-10)
  .max(10)
  .step(0.001);
gui
  .add(params, "initialCameraPositionY")
  .onChange((value) => {
    let camPos = cloud.initialCameraPosition;
    camPos.y = value;
    cloud.initialCameraPosition = camPos;
  })
  .min(-20)
  .max(20)
  .step(0.001);
gui
  .add(params, "initialCameraPositionZ")
  .onChange((value) => {
    let camPos = cloud.initialCameraPosition;
    camPos.z = value;
    cloud.initialCameraPosition = camPos;
  })
  .min(-20)
  .max(20)
  .step(0.001);
gui.addColor(params, "skyColor").onChange((value) => {
  cloud.skyColor = new THREE.Color(value);
});
gui.addColor(params, "skyColorFade").onChange((value) => {
  cloud.skyColorFade = new THREE.Color(value);
});
gui.addColor(params, "cloudColor").onChange((value) => {
  cloud.cloudColor = new THREE.Color(value);
});
gui.addColor(params, "sunColor").onChange((value) => {
  cloud.sunColor = new THREE.Color(value);
});

// todo: make uniform
gui
  .add(cloud, "pixelWidth")
  .min(2)
  .max(64)
  .step(2)
  .listen()
  .onChange(() => {
    params.lastTouchedPixelID = 0;
    if (params.uniformPixels) {
      cloud.pixelHeight = cloud.pixelWidth;
    }
  });

gui
  .add(cloud, "pixelHeight")
  .min(2)
  .max(64)
  .step(2)
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

const handleResize = () => {
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(dpr);
  composer.setSize(window.innerWidth, window.innerHeight);
  cloud.setSize(window.innerWidth * dpr, window.innerHeight * dpr);
  cloud.camera.aspect = window.innerWidth / window.innerHeight;
  cloud.camera.updateProjectionMatrix();
  if (!cloud.isAnimated()) {
    render();
  }
};
handleResize();
window.addEventListener("resize", handleResize);

cloud.orbitControls.addEventListener("change", () => {
  if (!cloud.isAnimated()) {
    render();
  }
});

console.log("Starting scene...");

function doAnimate(ms) {
  // Note: orbitControls.update() needs to be called after every manual update to the camera position
  // Also required if orbitControls.enableDamping or orbitControls.autoRotate are set to true.
  // See https://threejs.org/docs/?q=orbit#examples/en/controls/OrbitControls
  if (cloud.orbitControls.autoRotate || cloud.orbitControls.enableDamping) {
    cloud.orbitControls.update();
  }

  let timeSeconds = ms / 1000.0;
  //console.log("time (s):" + timeSeconds);
  cloud.time = timeSeconds;
  //console.log("animated:" + cloud.isAnimated());
  if (cloud.isAnimated()) {
    render();
  }
}

function render() {
  stats.begin();
  composer.render();
  stats.end();
}

function animate() {
  requestAnimationFrame(animate);
  if (!params.pause) {
    timer.update();
  }
  let time = timer.getElapsed();
  //console.log("time:" + time);
  doAnimate(time * 1000);
}

animate();

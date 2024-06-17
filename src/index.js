import * as THREE from "three";
import GUI from "lil-gui";

import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import Stats from "three/examples/jsm/libs/stats.module.js";

import Cloud from "./Cloud";
import { Timer } from "./Timer.js";

let tokenTest = false;

class ParameterIO {
  constructor(showCreateApplyPresetUI = false, parameterGUI = undefined) {
    this.parameterInfo = {};
    this.parameterGUI = parameterGUI;
    this.loadButton = undefined;
  }

  setParameterGUI(parameterGUI) {
    this.parameterGUI = parameterGUI;
  }

  createPreset() {
    this.parameterInfo = this.parameterGUI.save();
    if (this.loadButton != undefined) {
      this.loadButton.enable();
    }
  }

  applyPreset() {
    if (!this.empty) {
      this.parameterGUI.load(this.parameterInfo);
      if (this.loadButton != undefined) {
        this.loadButton.enable();
      }
    }
  }

  savePresetFile() {
    this.createPreset();

    // Convert JSON object to a string
    const jsonString = JSON.stringify(this.parameterInfo, null, 2);

    // Create a Blob from the JSON string
    const blob = new Blob([jsonString], { type: "application/json" });

    // Create a temporary anchor element
    const a = document.createElement("a");

    // Set the download attribute and file name
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = "cloudParameterPreset.json";

    // Append the anchor element to the body
    document.body.appendChild(a);

    // Click the anchor element to trigger download
    a.click();

    // Remove the anchor element from the body
    document.body.removeChild(a);

    // Revoke the object URL to free up memory
    URL.revokeObjectURL(url);
  }

  loadPresetFile() {
    // Create a file input element programmatically
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.style.display = "none"; // Ensure the input is not visible

    const io = this;
    // Add an event listener to handle file selection
    input.addEventListener("change", function (event) {
      const file = event.target.files[0];

      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            const json = JSON.parse(e.target.result);
            io.parameterInfo = json;
          } catch (error) {
            console.error("Error parsing JSON:", error);
            return;
          }

          io.applyPreset();
        };
        reader.readAsText(file);
      }
    });

    // Trigger the file input dialog
    input.click();
  }

  get empty() {
    return Object.keys(this.parameterInfo).length == 0;
  }

  addGUI(gui) {
    if (this.showCreateApplyPresetUI) {
      gui.add(this, "createPreset");
      this.loadButton = gui.add(this, "applyPreset");

      if (this.empty) {
        this.loadButton.disable();
      } else {
        this.loadButton.enable();
      }
    }

    gui.add(this, "savePresetFile");
    gui.add(this, "loadPresetFile");
  }
}

class PropertyRandomizer {
  constructor(properties = []) {
    this.properties = properties;
  }

  randomize() {
    this.properties.forEach((element, index) => {
      element.randomize();
    });
  }
}

class MinMaxProperty {
  static kAutoStepSizeResolution = 255;

  constructor(
    min,
    max,
    object,
    propertyName,
    randomizable = false,
    autoStepSize = true,
    customStepSize = 1,
  ) {
    this.min = min;
    this.max = max;
    this.object = object;
    this.propertyName = propertyName;
    this.autoStepSize = autoStepSize;
    this.customStepSize = customStepSize;

    this._randomizable = randomizable;

    this.controller = undefined;

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

    if (this.controller != undefined) {
      this.controller.updateDisplay();
    }
  }

  set randomizable(val) {
    this._randomizable = val;
  }

  get randomizable() {
    return this._randomizable;
  }

  randomize() {
    if (this.randomizable) {
      let r = Math.random();
      let stepSize = this.autoStepSize
        ? (this.max - this.min) / MinMaxProperty.kAutoStepSizeResolution
        : this.customStepSize;

      let steps = (r * (this.max - this.min)) / stepSize;
      steps = Math.round(steps);
      this.value = this.min + steps * stepSize;
    }
  }

  applyBounds() {
    let val = this.value;
    this.value = val;
  }

  addGUI(gui, collapsed = true) {
    let propertyGUI = gui.addFolder(this.propertyName);
    if (collapsed) propertyGUI.close();

    let controller = propertyGUI.add(this, "value").min(this.min).max(this.max);
    this.controller = controller;
    propertyGUI.add(this, "randomizable");

    if (this.autoStepSize)
      controller.step(
        (this.max - this.min) / MinMaxProperty.kAutoStepSizeResolution,
      );
    else controller.step(this.customStepSize);

    propertyGUI.add(this, "min").onChange((value) => {
      controller.min(value);
      this.applyBounds();
      if (this.autoStepSize)
        controller.step(
          (this.max - this.min) / MinMaxProperty.kAutoStepSizeResolution,
        );
      controller.updateDisplay();
    });

    propertyGUI.add(this, "max").onChange((value) => {
      controller.max(value);
      this.applyBounds();
      if (this.autoStepSize)
        controller.step(
          (this.max - this.min) / MinMaxProperty.kAutoStepSizeResolution,
        );
      controller.updateDisplay();
    });

    return this;
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

let cloud = new Cloud(renderer.domElement, {
  cloudSeed: cloudSeed, //83.0,
  cloudSize: new THREE.Vector3(2, 1, 2),
  sunPosition: new THREE.Vector3(sunPositionX, sunPositionY, sunPositionZ),
});

let params = {
  sunPositionX: sunPositionX, //4.0,
  sunPositionY: sunPositionY, //3.5,
  sunPositionZ: sunPositionZ, //-1.0,
  initialCameraPositionX: cloud.initialCameraPosition.x,
  initialCameraPositionY: cloud.initialCameraPosition.y,
  initialCameraPositionZ: cloud.initialCameraPosition.z,
  pause: false,
};

let composer = new EffectComposer(renderer);
composer.addPass(cloud);

let gui = new GUI();
gui.add(params, "pause");

let tools = gui.addFolder("Tools");
tools.open();
let properties = [];
let randomizer = new PropertyRandomizer(properties);
tools.add(randomizer, "randomize");

let snapshots = tools.addFolder("Presets");
snapshots.close();
let parameterIO = new ParameterIO();
parameterIO.addGUI(snapshots);

let parameters = gui.addFolder("Parameters");
parameterIO.setParameterGUI(parameters);

parameters.close();
properties.push(
  new MinMaxProperty(0.1, 10, cloud, "shift").addGUI(parameters, false),
);
properties.push(
  new MinMaxProperty(-1, 1, cloud, "shiftDirection", false, false, 2).addGUI(
    parameters,
  ),
);
properties.push(
  new MinMaxProperty(1, 32000, cloud, "cloudSeed").addGUI(parameters),
);
properties.push(
  new MinMaxProperty(-5, 5, cloud, "cloudShape", true).addGUI(
    parameters,
    false,
  ),
);
properties.push(
  new MinMaxProperty(1, 30, cloud, "cloudCount", false, false, 1).addGUI(
    parameters,
  ),
);
properties.push(
  new MinMaxProperty(0.8, 3, cloud, "cloudSizeFactor").addGUI(parameters),
);
properties.push(
  new MinMaxProperty(0, 3, cloud, "cloudMinimumDensity").addGUI(parameters),
);
properties.push(
  new MinMaxProperty(0, 3, cloud, "cloudRoughness").addGUI(parameters),
);
properties.push(
  new MinMaxProperty(1.5, 6, cloud, "cloudScatter").addGUI(parameters),
);
properties.push(
  new MinMaxProperty(0, 5, cloud, "cloudAnimationSpeed").addGUI(parameters),
);
properties.push(
  new MinMaxProperty(0, 5, cloud, "cloudAnimationStrength").addGUI(parameters),
);
properties.push(
  new MinMaxProperty(0, 1, cloud, "sunIntensity").addGUI(parameters),
);
properties.push(new MinMaxProperty(-2, 2, cloud, "sunSize").addGUI(parameters));
properties.push(
  new MinMaxProperty(0, 10, cloud, "skyFadeFactor").addGUI(parameters),
);
properties.push(
  new MinMaxProperty(-4, 4, cloud, "skyFadeShift").addGUI(parameters),
);
properties.push(
  new MinMaxProperty(0.8, 1.2, cloud, "tileMixFactor").addGUI(parameters),
);
properties.push(
  new MinMaxProperty(0, 17, cloud, "skyTileIndex", false, false).addGUI(
    parameters,
  ),
);
properties.push(
  new MinMaxProperty(0, 17, cloud, "cloudTileIndex", false, false).addGUI(
    parameters,
  ),
);
properties.push(
  new MinMaxProperty(2, 128, cloud, "pixelSize", false, false, 2).addGUI(
    parameters,
  ),
);

parameters.addColor(cloud, "skyColor");
parameters.addColor(cloud, "skyColorFade");
parameters.addColor(cloud, "cloudColor");
parameters.addColor(cloud, "sunColor");

parameters
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
parameters
  .add(params, "sunPositionY")
  .onChange((value) => {
    let sunPos = cloud.sunPosition;
    sunPos.y = value;
    cloud.sunPosition = sunPos;
  })
  .min(-10)
  .max(10)
  .step(0.001);
parameters
  .add(params, "sunPositionZ")
  .onChange((value) => {
    let sunPos = cloud.sunPosition;
    sunPos.z = value;
    cloud.sunPosition = sunPos;
  })
  .min(-10)
  .max(10)
  .step(0.001);
parameters
  .add(params, "initialCameraPositionY")
  .onChange((value) => {
    let camPos = cloud.initialCameraPosition;
    camPos.y = value;
    cloud.initialCameraPosition = camPos;
  })
  .min(-20)
  .max(20)
  .step(0.001);
parameters
  .add(params, "initialCameraPositionZ")
  .onChange((value) => {
    let camPos = cloud.initialCameraPosition;
    camPos.z = value;
    cloud.initialCameraPosition = camPos;
  })
  .min(-20)
  .max(20)
  .step(0.001);

parameters.add(cloud, "cameraAngle").min(-90).max(90);

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

cloud.cameraControls.addEventListener("change", () => {
  if (!cloud.isAnimated()) {
    render();
  }
});

console.log("Starting scene...");

function doAnimate(ms) {
  // Note: cameraControls.update() needs to be called after every manual update to the camera position
  // Also required if cameraControls.enableDamping or cameraControls.autoRotate are set to true.
  // See https://threejs.org/docs/?q=orbit#examples/en/controls/OrbitControls
  if (cloud.cameraControls.autoRotate || cloud.cameraControls.enableDamping) {
    cloud.cameraControls.update();
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

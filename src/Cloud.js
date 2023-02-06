import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import { fragmentShader } from "./shaders";

// Todo: derive here from Pass as in https://github.com/mrdoob/three.js/blob/dev/examples/jsm/postprocessing/RenderPixelatedPass.js
class Cloud extends FullScreenQuad {
  constructor({
    cloudSize = new THREE.Vector3(0.5, 1.0, 0.5),
    sunPosition = new THREE.Vector3(1.0, 2.0, 1.0),
    cloudColor = new THREE.Color(0xeabf6b),
    skyColor = new THREE.Color(0x337fff),
    cloudSteps = 48,
    shadowSteps = 8,
    cloudLength = 16,
    shadowLength = 2,
    noise = false,
    turbulence = 0.0,
    shift = false,
  } = {}) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uCloudSize: {
          value: cloudSize,
        },
        uSunPosition: {
          value: sunPosition,
        },
        uCameraPosition: {
          value: new THREE.Vector3(),
        },
        uCloudColor: {
          value: cloudColor,
        },
        uSkyColor: {
          value: skyColor,
        },
        uCloudSteps: {
          value: cloudSteps,
        },
        uShadowSteps: {
          value: shadowSteps,
        },
        uCloudLength: {
          value: cloudLength,
        },
        uShadowLength: {
          value: shadowLength,
        },
        uResolution: {
          value: new THREE.Vector2(),
        },
        uTime: {
          value: 0,
        },
        uNoise: {
          value: noise,
        },
        uTurbulence: {
          value: turbulence,
        },
        uShift: {
          value: shift,
        },
        projectionMatrixInverse: {
          value: null,
        },
        viewMatrixInverse: {
          value: null,
        },
      },
      fragmentShader,
    });

    super(material);
  }

  get cloudSize() {
    return this.material.uniforms.uCloudSize.value;
  }

  get sunPosition() {
    return this.material.uniforms.uSunPosition.value;
  }

  get skyColor() {
    return this.material.uniforms.uSkyColor.value;
  }

  set skyColor(value) {
    this.material.uniforms.uSkyColor.value = value;
  }

  get cloudColor() {
    return this.material.uniforms.uCloudColor.value;
  }

  set cloudColor(value) {
    this.material.uniforms.uCloudColor.value = value;
  }

  get noise() {
    return this.material.uniforms.uNoise.value;
  }

  set noise(value) {
    this.material.uniforms.uNoise.value = value;
  }

  set turbulence(value) {
    this.material.uniforms.uTurbulence.value = value;
  }

  get turbulence() {
    return this.material.uniforms.uTurbulence.value;
  }

  get time() {
    return this.material.uniforms.uTime.value;
  }

  set time(value) {
    this.material.uniforms.uTime.value = value;
  }

  setSize(width, height) {
    this.material.uniforms.uResolution.value.set(width, height);
  }

  isAnimated() {
    return (
      this.material.uniforms.uNoise.value ||
      this.material.uniforms.uTurbulence.value > 0 ||
      this.material.uniforms.uShift.value
    );
  }

  render(renderer, camera) {
    this.material.uniforms.uCameraPosition.value.copy(camera.position);
    this.material.uniforms.projectionMatrixInverse.value =
      camera.projectionMatrixInverse;
    this.material.uniforms.viewMatrixInverse.value = camera.matrixWorld;
    //console.log("rendering...");
    super.render(renderer);
  }
}

export default Cloud;

import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import { fragmentShader } from "./shaders";

class Cloud extends Pass {
  constructor(
    camera,
    {
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
    } = {}
  ) {
    super();

    this.cloudMaterial = new THREE.ShaderMaterial({
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

    this.camera = camera;
    this.cloudFullScreenQuad = new Pass.FullScreenQuad(this.cloudMaterial);
    this.passThroughMaterial = this.createPassThroughMaterial();
    this.passThroughFullScreenQuad = new Pass.FullScreenQuad(
      this.passThroughMaterial
    );
  }

  get material() {
    return this.cloudMaterial;
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

  get shift() {
    return this.material.uniforms.uShift.value;
  }

  set shift(value) {
    this.material.uniforms.uShift.value = value;
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
    //console.log("noise:" + this.material.uniforms.uNoise.value);
    //console.log("turbulence:" + this.material.uniforms.uTurbulence.value);
    //console.log("shift:" + this.material.uniforms.uShift.value);
    return (
      this.material.uniforms.uNoise.value ||
      this.material.uniforms.uTurbulence.value > 0.0 ||
      this.material.uniforms.uShift.value
    );
  }

  doRender(renderer) {
    this.material.uniforms.uCameraPosition.value.copy(this.camera.position);
    this.material.uniforms.projectionMatrixInverse.value =
      this.camera.projectionMatrixInverse;
    this.material.uniforms.viewMatrixInverse.value = this.camera.matrixWorld;

    this.cloudFullScreenQuad.render(renderer);
  }

  render(renderer, writeBuffer) {
    //console.log("render pass call...");
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) {
        renderer.clear();
      }
    }

    this.doRender(renderer);
  }

  createPassThroughMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
      },
      vertexShader: /* glsl */ `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}
			`,
      fragmentShader: /* glsl */ `
				uniform sampler2D tDiffuse;
				varying vec2 vUv;

				void main() {
					vec4 texel = texture2D( tDiffuse, vUv );
					gl_FragColor = texel * Strength;
				}
			`,
    });
  }
}

export default Cloud;

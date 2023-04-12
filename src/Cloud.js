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
      shift = 1.0,
      pixelWidth = 1,
      pixelHeight = 1,
      UVTest = false,
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

    this.UVTest = UVTest;
    this.resolution = new THREE.Vector2();
    this.pixelMultiplier = [pixelWidth, pixelHeight];
    this.camera = camera;
    this.cloudFullScreenQuad = new Pass.FullScreenQuad(this.cloudMaterial);
    this.passThroughMaterial = this.createPassThroughMaterial();
    this.passThroughFullScreenQuad = new Pass.FullScreenQuad(
      this.passThroughMaterial
    );

    this.cloudRenderTarget = new THREE.WebGLRenderTarget();
    this.cloudRenderTarget.texture.minFilter = THREE.NearestFilter;
    this.cloudRenderTarget.texture.magFilter = THREE.NearestFilter;
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

  set pixelWidth(value) {
    this.pixelMultiplier[0] = value;
    this.setSize(this.resolution.x, this.resolution.y);
  }

  get pixelWidth() {
    return this.pixelMultiplier[0];
  }

  set pixelHeight(value) {
    this.pixelMultiplier[1] = value;
    this.setSize(this.resolution.x, this.resolution.y);
  }

  get pixelHeight() {
    return this.pixelMultiplier[1];
  }

  setSize(width, height) {
    this.resolution.set(width, height);
    this.material.uniforms.uResolution.value.set(
      width / this.pixelMultiplier[0],
      height / this.pixelMultiplier[1]
    );
    this.cloudRenderTarget.setSize(
      width / this.pixelMultiplier[0],
      height / this.pixelMultiplier[1]
    );
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

  render(renderer, writeBuffer) {
    //console.log("render pass call...");
    this.material.uniforms.uCameraPosition.value.copy(this.camera.position);
    this.material.uniforms.projectionMatrixInverse.value =
      this.camera.projectionMatrixInverse;
    this.material.uniforms.viewMatrixInverse.value = this.camera.matrixWorld;

    renderer.setRenderTarget(this.cloudRenderTarget);
    this.cloudFullScreenQuad.render(renderer);

    const uniforms = this.passThroughMaterial.uniforms;
    uniforms.tDiffuse.value = this.cloudRenderTarget.texture;
    uniforms.uUVTest.value = this.UVTest;

    if (this.renderToScreen) {
      //console.log("render to screen");
      renderer.setRenderTarget(null);
    } else {
      //console.log("render to buffer");
      renderer.setRenderTarget(writeBuffer);
      if (this.clear) {
        renderer.clear();
      }
    }

    this.passThroughFullScreenQuad.render(renderer);
  }

  createPassThroughMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uUVTest: { value: false },
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
        uniform bool uUVTest;
				varying vec2 vUv;

				void main() {
					vec4 texel = texture2D( tDiffuse, vUv );
          texel.r += float(uUVTest) * vUv.x;
          texel.g += float(uUVTest) * vUv.y;
					gl_FragColor = texel;
				}
			`,
    });
  }
}

export default Cloud;

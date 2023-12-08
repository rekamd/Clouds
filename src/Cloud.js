import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import { cloudFragmentShader, random } from "./shaders";
import * as Shaders from "./shaders";
import { Tiles } from "./Tiles";

class Cloud extends Pass {
  constructor(
    camera,
    {
      cloudSeed = 83.0,
      cloudCount = 8,
      cloudSize = new THREE.Vector3(2, 1, 2),
      cloudMinimumDensity = 0.0,
      cloudRoughness = 2.0,
      cloudScatter = 2.2,
      cloudShape = 0.5453,
      cloudAnimationSpeed = 0.2,
      cloudAnimationStrength = 0.6,
      sunIntensity = 1.0,
      sunSize = 0.15,
      sunPosition = new THREE.Vector3(4.0, 3.5, -1.0),
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
      tileMixFactor = 0.5,
      blur = false,
      UVTest = false,
    } = {},
  ) {
    super();

    this.sunPos = sunPosition;
    this.cloudMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uCloudSeed: {
          value: cloudSeed,
        },
        uCloudCount: {
          value: cloudCount,
        },
        uCloudSize: {
          value: cloudSize,
        },
        uCloudMinimumDensity: {
          value: cloudMinimumDensity,
        },
        uCloudRoughness: {
          value: cloudRoughness,
        },
        uCloudScatter: {
          value: cloudScatter,
        },
        uCloudShape: {
          value: cloudShape,
        },
        uCloudAnimationSpeed: {
          value: cloudAnimationSpeed,
        },
        uCloudAnimationStrength: {
          value: cloudAnimationStrength,
        },
        uSunIntensity: {
          value: sunIntensity,
        },
        uSunSize: {
          value: sunSize,
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
      fragmentShader: Shaders.cloudFragmentShader,
    });

    this.tiles = new Tiles();
    this.UVTest = UVTest;
    this.tileMixFactor = tileMixFactor;
    this.resolution = new THREE.Vector2();
    this.pixelMultiplier = [pixelWidth, pixelHeight];
    this.camera = camera;
    this.cloudFullScreenQuad = new Pass.FullScreenQuad(this.cloudMaterial);
    this.passThroughMaterial = this.createPassThroughMaterial();
    this.passThroughMaterial.uniforms.tTileAtlasSky.value =
      this.tiles.tileTextureAtlasArray[0];
    this.passThroughMaterial.uniforms.tTileAtlasCloud.value =
      this.tiles.tileTextureAtlasArray[0];

    this.passThroughFullScreenQuad = new Pass.FullScreenQuad(
      this.passThroughMaterial,
    );

    this.cloudRenderTarget = new THREE.WebGLRenderTarget();
    const filter = blur ? THREE.LinearFilter : THREE.NearestFilter;
    this.cloudRenderTarget.texture.minFilter = filter;
    this.cloudRenderTarget.texture.magFilter = filter;
  }

  set blur(value) {
    if (this.blur != value) {
      const filter = value ? THREE.LinearFilter : THREE.NearestFilter;
      // After initial use, the texture can not be changed. Need to create a new one
      // In this case, need to recreate the entire render target.
      this.cloudRenderTarget.dispose();
      this.cloudRenderTarget = new THREE.WebGLRenderTarget();
      this.cloudRenderTarget.texture.minFilter = filter;
      this.cloudRenderTarget.texture.magFilter = filter;
      this.setSize(this.resolution.x, this.resolution.y);
    }
  }

  get blur() {
    return this.cloudRenderTarget.texture.minFilter == THREE.LinearFilter;
  }

  get material() {
    return this.cloudMaterial;
  }

  get cloudSeed() {
    return this.material.uniforms.uCloudSeed.value;
  }

  set cloudSeed(value) {
    this.material.uniforms.uCloudSeed.value = value;
  }

  get cloudCount() {
    return this.material.uniforms.uCloudCount.value;
  }

  set cloudCount(value) {
    this.material.uniforms.uCloudCount.value = value;
  }

  get cloudSize() {
    return this.material.uniforms.uCloudSize.value;
  }

  get cloudMinimumDensity() {
    return this.material.uniforms.uCloudMinimumDensity.value;
  }

  set cloudMinimumDensity(value) {
    this.material.uniforms.uCloudMinimumDensity.value = value;
  }

  get cloudRoughness() {
    return this.material.uniforms.uCloudRoughness.value;
  }

  set cloudRoughness(value) {
    this.material.uniforms.uCloudRoughness.value = value;
  }

  get cloudScatter() {
    return this.material.uniforms.uCloudScatter.value;
  }

  set cloudScatter(value) {
    this.material.uniforms.uCloudScatter.value = value;
  }

  get cloudShape() {
    return this.material.uniforms.uCloudShape.value;
  }

  set cloudShape(value) {
    this.material.uniforms.uCloudShape.value = value;
  }

  get cloudAnimationSpeed() {
    return this.material.uniforms.uCloudAnimationSpeed.value;
  }

  set cloudAnimationSpeed(value) {
    this.material.uniforms.uCloudAnimationSpeed.value = value;
  }

  get cloudAnimationStrength() {
    return this.material.uniforms.uCloudAnimationStrength.value;
  }

  set cloudAnimationStrength(value) {
    this.material.uniforms.uCloudAnimationStrength.value = value;
  }

  get sunIntensity() {
    return this.material.uniforms.uSunIntensity.value;
  }

  set sunIntensity(value) {
    this.material.uniforms.uSunIntensity.value = value;
  }

  get sunSize() {
    return this.material.uniforms.uSunSize.value;
  }

  set sunSize(value) {
    this.material.uniforms.uSunSize.value = value;
  }

  get sunPosition() {
    return this.sunPos;
  }

  set sunPosition(value) {
    this.material.uniforms.uSunPosition.value = value;
    this.sunPos = value;
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
    this.passThroughMaterial.uniforms.uTime.value = value;
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
    const resX = width / this.pixelMultiplier[0];
    const resY = height / this.pixelMultiplier[1];
    this.material.uniforms.uResolution.value.set(resX, resY);
    this.passThroughMaterial.uniforms.uResolution.value.set(resX, resY);
    this.cloudRenderTarget.setSize(resX, resY);
  }

  setTileTextureIndex(skyTiles, tileIndex) {
    let tiles = new Tiles();
    if (skyTiles) {
      this.passThroughMaterial.uniforms.tTileAtlasSky.value =
        tiles.tileTextureAtlasArray[tileIndex];
    } else {
      this.passThroughMaterial.uniforms.tTileAtlasCloud.value =
        tiles.tileTextureAtlasArray[tileIndex];
    }
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
    uniforms.uTileMixFactor.value = this.tileMixFactor;

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
        tTileAtlasSky: { value: null },
        tTileAtlasCloud: { value: null },
        uUVTest: { value: false },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2() },
        uTileMixFactor: { value: 0.5 },
      },
      vertexShader: Shaders.tileVertexShader,
      fragmentShader: Shaders.tileFragmentShader,
    });
  }
}

export default Cloud;

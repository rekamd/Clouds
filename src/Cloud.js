import * as THREE from "three";
import { Pass } from "three/examples/jsm/postprocessing/Pass";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as Shaders from "./shaders";
import { Tiles } from "./Tiles";

class Cloud extends Pass {
  constructor(
    domElement,
    {
      skyTileIndex = 0,
      cloudTileIndex = 0,
      hullTileIndex = 0,
      cloudSeed = 83.0,
      cloudCount = 8,
      cloudSize = new THREE.Vector3(2, 1, 2),
      cloudSizeFactor = 1.0,
      cloudMinimumDensity = 0.0,
      cloudRoughness = 2.0,
      cloudScatter = 2.2,
      cloudShape = 0.5453,
      cloudAnimationSpeed = 0.2,
      cloudAnimationStrength = 0.6,
      sunIntensity = 0.6,
      sunSize = -1.6,
      sunPosition = new THREE.Vector3(4.0, 3.5, -1.0),
      cloudColor = 0xeabf6b,
      skyColor = 0x337fff,
      skyColorFade = 0xffffff,
      skyFadeFactor = 0.5,
      skyFadeShift = 0.7,
      sunColor = 0xff9919,
      cloudSteps = 64,
      shadowSteps = 32, // orig: 8, but too noisy
      cloudLength = 32,
      shadowLength = 8, // orig: 2, but too dark
      noise = false,
      shift = 3.0,
      shiftDirection = 1.0,
      pixelWidth = 10,
      pixelHeight = 10,
      tileMixFactor = 1.0,
      windowFrameScale = 0.4,
      blur = false,
      cameraAngle = 45.0,
      cloudOffset = 8.0,
      backgroundCloudOffset = 8.0,
      backgroundCloudUpShift = -12.0,
    } = {}
  ) {
    super();

    this._shift = shift;
    this._shiftDirection = shiftDirection;
    this._cloudSize = cloudSize;
    this._cloudSizeFactor = cloudSizeFactor;
    cloudSize.multiplyScalar(cloudSizeFactor);
    this.cloudMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uCloudOffset: {
          value: cloudOffset,
        },
        uBackgroundCloudOffset: {
          value: backgroundCloudOffset,
        },
        uBackgroundCloudUpShift: {
          value: backgroundCloudUpShift,
        },
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
        uCloudPosition: {
          value: new THREE.Vector3(0, 0, 0),
        },
        uCameraDirection: {
          value: new THREE.Vector3(0, 0, 1),
        },
        uCloudColor: {
          value: new THREE.Color(cloudColor),
        },
        uSkyColor: {
          value: new THREE.Color(skyColor),
        },
        uSkyColorFade: {
          value: new THREE.Color(skyColorFade),
        },
        uSkyFadeFactor: {
          value: skyFadeFactor,
        },
        uSkyFadeShift: {
          value: skyFadeShift,
        },
        uSunColor: {
          value: new THREE.Color(sunColor),
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
        uShift: {
          value: shift * shiftDirection,
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

    // setup camera
    let cameraPosition = new THREE.Vector3(0, -7.5, 8.0);
    const camera = new THREE.PerspectiveCamera(70);
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);

    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = true;

    this.camera = camera;
    this.cameraControls = controls;

    this.cameraAngle = cameraAngle;

    // set cloud position to initial camera position
    let initialCameraPosition = new THREE.Vector3();
    initialCameraPosition.copy(camera.position);
    this.cloudPosition = initialCameraPosition;

    this.tiles = new Tiles();
    this.tileMixFactor = tileMixFactor;
    this.windowFrameScale = windowFrameScale;
    this.resolution = new THREE.Vector2();
    this.pixelMultiplier = [pixelWidth, pixelHeight];
    this.cloudFullScreenQuad = new Pass.FullScreenQuad(this.cloudMaterial);
    this.passThroughMaterial = this.createPassThroughMaterial();

    this._skyTileIndex = skyTileIndex;
    this._cloudTileIndex = cloudTileIndex;
    this._hullTileIndex = hullTileIndex;
    this.updateTileTextureSamplers();

    this.passThroughFullScreenQuad = new Pass.FullScreenQuad(
      this.passThroughMaterial
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

  set cloudSizeFactor(val) {
    this._cloudSizeFactor = val;
    let cloudSize = new THREE.Vector3();
    cloudSize.copy(this._cloudSize);
    cloudSize.multiplyScalar(val);
    this.material.uniforms.uCloudSize.value = cloudSize;
  }

  get cloudSizeFactor() {
    return this._cloudSizeFactor;
  }

  get cloudSize() {
    return this._cloudSize;
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
    return this.material.uniforms.uSunPosition.value;
  }

  set sunPosition(value) {
    this.material.uniforms.uSunPosition.value = value;
  }

  get cloudPosition() {
    return this.material.uniforms.uCloudPosition.value;
  }

  set cloudPosition(value) {
    this.material.uniforms.uCloudPosition.value = value;
  }

  get skyColor() {
    return this.material.uniforms.uSkyColor.value.getHex();
  }

  set skyColor(value) {
    this.material.uniforms.uSkyColor.value = new THREE.Color(value);
  }

  get skyColorFade() {
    return this.material.uniforms.uSkyColorFade.value.getHex();
  }

  set skyColorFade(value) {
    this.material.uniforms.uSkyColorFade.value = new THREE.Color(value);
  }

  get skyFadeFactor() {
    return this.material.uniforms.uSkyFadeFactor.value;
  }

  set skyFadeFactor(value) {
    this.material.uniforms.uSkyFadeFactor.value = value;
  }

  get skyFadeShift() {
    return this.material.uniforms.uSkyFadeShift.value;
  }

  set skyFadeShift(value) {
    this.material.uniforms.uSkyFadeShift.value = value;
  }

  get cloudColor() {
    return this.material.uniforms.uCloudColor.value.getHex();
  }

  set cloudColor(value) {
    this.material.uniforms.uCloudColor.value = new THREE.Color(value);
  }

  get sunColor() {
    return this.material.uniforms.uSunColor.value.getHex();
  }

  set sunColor(value) {
    this.material.uniforms.uSunColor.value = new THREE.Color(value);
  }

  get shift() {
    return this._shift;
  }

  set shift(value) {
    this._shift = value;
    this.material.uniforms.uShift.value = this._shift * this._shiftDirection;
  }

  get shiftDirection() {
    return this._shiftDirection;
  }

  set shiftDirection(value) {
    this._shiftDirection = value;
    this.material.uniforms.uShift.value = this._shift * this._shiftDirection;
  }

  get noise() {
    return this.material.uniforms.uNoise.value;
  }

  set noise(value) {
    this.material.uniforms.uNoise.value = value;
  }

  get time() {
    return this.material.uniforms.uTime.value;
  }

  set time(value) {
    this.passThroughMaterial.uniforms.uTime.value = value;
    this.material.uniforms.uTime.value = value;
  }

  set pixelSize(value) {
    this.pixelWidth = this.pixelHeight = value;
  }

  get pixelSize() {
    return Math.max(this.pixelWidth, this.pixelHeight);
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

  set skyTileIndex(value) {
    this._skyTileIndex = value;
    this.updateTileTextureSamplers();
  }

  get skyTileIndex() {
    return this._skyTileIndex;
  }

  set cloudTileIndex(value) {
    this._cloudTileIndex = value;
    this.updateTileTextureSamplers();
  }

  get cloudTileIndex() {
    return this._cloudTileIndex;
  }

  set hullTileIndex(value) {
    this._hullTileIndex = value;
    this.updateTileTextureSamplers();
  }

  get hullTileIndex() {
    return this._hullTileIndex;
  }

  updateTileTextureSamplers(skyTiles, tileIndex) {
    this.passThroughMaterial.uniforms.tTileAtlasSky.value =
      this.tiles.tileTextureAtlasArray[this._skyTileIndex];
    this.passThroughMaterial.uniforms.tTileAtlasCloud.value =
      this.tiles.tileTextureAtlasArray[this._cloudTileIndex];
    this.passThroughMaterial.uniforms.tTileAtlasHull.value =
      this.tiles.tileTextureAtlasArray[this._hullTileIndex];
  }

  set cameraAngle(value) {
    this._cameraAngle = value;

    let cameraAngleRad = THREE.MathUtils.degToRad(this._cameraAngle);
    let direction = new THREE.Vector3(
      0,
      Math.sin(cameraAngleRad),
      -Math.cos(cameraAngleRad)
    );

    let lookAtPosition = new THREE.Vector3();
    lookAtPosition.copy(this.camera.position);
    lookAtPosition.add(direction);

    this.cameraControls.target.set(
      lookAtPosition.x,
      lookAtPosition.y,
      lookAtPosition.z
    );

    this.cameraControls.update();

    let cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);

    this.material.uniforms.uCameraDirection.value = cameraDirection;
  }

  get cameraAngle() {
    return this._cameraAngle;
  }

  set cloudOffset(value) {
    this.material.uniforms.uCloudOffset.value = value;
  }

  get cloudOffset() {
    return this.material.uniforms.uCloudOffset.value;
  }

  set backgroundCloudOffset(value) {
    this.material.uniforms.uBackgroundCloudOffset.value = value;
  }

  get backgroundCloudOffset() {
    return this.material.uniforms.uBackgroundCloudOffset.value;
  }

  set backgroundCloudUpShift(value) {
    this.material.uniforms.uBackgroundCloudUpShift.value = value;
  }

  get backgroundCloudUpShift() {
    return this.material.uniforms.uBackgroundCloudUpShift.value;
  }

  isAnimated() {
    return (
      this.material.uniforms.uNoise.value || this.material.uniforms.uShift.value
    );
  }

  render(renderer, writeBuffer) {
    this.material.uniforms.projectionMatrixInverse.value =
      this.camera.projectionMatrixInverse;
    this.material.uniforms.viewMatrixInverse.value = this.camera.matrixWorld;

    renderer.setRenderTarget(this.cloudRenderTarget);
    this.cloudFullScreenQuad.render(renderer);

    const uniforms = this.passThroughMaterial.uniforms;
    uniforms.tDiffuse.value = this.cloudRenderTarget.texture;
    uniforms.uTileMixFactor.value = this.tileMixFactor;
    uniforms.uWindowFrameScale.value = this.windowFrameScale;

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
        tTileAtlasHull: { value: null },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2() },
        uTileMixFactor: { value: 0.5 },
        uWindowFrameScale: { value: 0.4 },
      },
      vertexShader: Shaders.tileVertexShader,
      fragmentShader: Shaders.tileFragmentShader,
    });
  }
}

export default Cloud;

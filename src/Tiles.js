import * as THREE from "three";

class ImageData {
  static emoji_30Small =
    "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";
}

class Tiles {
  constructor() {
    // instantiate a loader
    const loader = new THREE.TextureLoader();
    const dataURL = "data:image/jpeg;base64," + ImageData.emoji_30Small;
    this.texture = loader.load(dataURL);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    // Todo: for tiling (see Texture.repeat) and wrapping to work, the texture needs to be a power of 2
    // See here for details: https://threejs.org/docs/#api/en/textures/Texture
  }
}

export { Tiles };
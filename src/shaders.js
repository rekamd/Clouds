export const random = /* glsl */ `
float random(float x, float seed)
{
  return fract(sin(x * (seed + 78.233))*(seed + 43758.5453123));
}

float random(float seed)
{
  return fract(sin(seed + 78.233)*(seed + 43758.5453123));
}

float random(vec2 st, float seed)
{
  return fract(sin(dot(st, vec2(seed + 12.9898, seed + 78.233))) * (seed + 43758.5453123));
}

vec3 random3D(float x, float seed)
{
  return vec3(random(x, seed), random(x+17.928, seed), random(x+43.132, seed));
}

vec3 random3D(float seed)
{
  return vec3(random(seed), random(seed+17.928), random(seed+43.132));
}

// Todo: add halton sequence random function here
`;

export const cloudFragmentShader = /* glsl */ `

  uniform float uCloudSeed;
  uniform int uCloudCount;
  uniform vec3 uCloudSize;
  uniform float uCloudMinimumDensity;
  uniform float uCloudRoughness;
  uniform float uCloudScatter;
  uniform float uCloudShape;
  uniform float uCloudAnimationSpeed;
  uniform float uCloudAnimationStrength;
  uniform float uSunSize;
  uniform float uSunIntensity;
  uniform vec3 uSunPosition;
  uniform vec3 uCloudPosition;
  uniform vec3 uCameraDirection;
  uniform vec3 uCloudColor;
  uniform vec3 uSkyColor;
  uniform vec3 uSkyColorFade;
  uniform float uSkyFadeFactor;
  uniform float uSkyFadeShift;
  uniform vec3 uSunColor;
  uniform float uCloudSteps;
  uniform float uShadowSteps;
  uniform float uCloudLength;
  uniform float uShadowLength;
  uniform vec2 uResolution;
  uniform mat4 projectionMatrixInverse;
  uniform mat4 viewMatrixInverse;
  uniform float uTime;
  uniform bool uNoise;
  uniform float uShift;
  uniform float uCloudOffset;
  uniform float uBackgroundCloudOffset;
  uniform float uBackgroundCloudUpShift;

  #define FLT_MAX 3.402823466e+38
  #define FLT_MIN 1.175494351e-38

  ${random}

  mat3 m = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
  float hash(float n, float shape, float animationSpeed, float animationStrength, float time) {
    // Original:
    //return fract( (sin(n) + cos(n)) * shape);
    
    // Note: adding a component to the cloud hash for animation through
    // a circular function (here sine) nicely grows and shrinks
    // the clouds. If a value we modify over time for this animation effect
    // would be part of a fract function, we would see jumping.
    
    //return fract((sin(n) + cos(n)) * shape) + sin(time * animationSpeed);
    // more interesting, less simplistic animation pattern
    return fract((sin(n) + cos(n)) * (43758.5453 + shape)) + animationStrength * pow(sin((time * animationSpeed)/3.0), 5.0);
  }

  float noise(vec3 x, float shape, float time) {
    vec3 p = floor(x);
    vec3 f = fract(x);

    f = f * f * (3.0 - 2.0 * f);

    float animationSpeed = uCloudAnimationSpeed;
    float animationStrength = uCloudAnimationStrength;
    float n = p.x + p.y * 57.0 + 113.0 * p.z;
    float res = mix(mix(mix(hash(n + 0.0, shape, animationSpeed, animationStrength, time), hash(n + 1.0, shape, animationSpeed, animationStrength, time), f.x),
                        mix(hash(n + 57.0, shape, animationSpeed, animationStrength, time), hash(n + 58.0, shape, animationSpeed, animationStrength, time), f.x), f.y),
                    mix(mix(hash(n + 113.0, shape, animationSpeed, animationStrength, time), hash(n + 114.0, shape, animationSpeed, animationStrength, time), f.x),
                        mix(hash(n + 170.0, shape, animationSpeed, animationStrength, time), hash(n + 171.0, shape, animationSpeed, animationStrength, time), f.x), f.y), f.z);

    return res;
  }

  float fbm(vec3 p, float shape, float roughness, float time) {
    float f = 0.0;
    float r = roughness;
    float t = 0.01;
    f += 0.5 * noise(p, shape, time); p = m * p * (r + 2.0 * t);
    f += 0.25 * noise(p, shape, time); p = m * p * (r + 3.0 * t);
    f += 0.125 * noise(p, shape, time); p = m * p * (r + t);
    f += 0.0625 * noise(p, shape, time);
    return f;
  }

  float cloudDepth(vec3 position, vec3 invCloudSize, float cloudScatter, float cloudShape, float cloudRoughness, float time) {
    float ellipse = 1.0 - length(position * invCloudSize);
    float cloud = ellipse + fbm(position, cloudShape, cloudRoughness, time) * cloudScatter + uCloudMinimumDensity;

    return min(max(0.0, cloud), 1.0);
  }

  float randShiftAndScale(float val, float maxScale, float maxShift, float seed)
  {
    return (val + maxShift * random(seed)) * maxScale * abs(random(seed+31.72));
  }

  float cmax(vec3 v)
  {
    return max(max(v.x,v.y),v.z);
  }

  #define MAX_CLOUD_COUNT 128
  
  // https://shaderbits.com/blog/creating-volumetric-ray-marcher
  vec4 cloudMarch(int cloudCount, float seed, float jitter, float turbulence,
    vec3 cloudSize, float cloudScatter, float cloudShape, float cloudRoughness,
    float time, float shift,
    vec3 position, vec3 lightDirection, vec3 ray, float rayShift)
  {
    float stepLength = uCloudLength / uCloudSteps;
    float shadowStepLength = uShadowLength / uShadowSteps;
    vec3 invCloudSize = 1.0 / cloudSize;

    vec3 cloudPosition = position + ray * (turbulence * stepLength + rayShift);

    // todo: review this given camera positioning. If we always shift along x and camera x is zero
    // we could make some assumptions here.
    // Alternatively we should probably use the cloudPos input to this function together with the
    // shiftDirection as indication for the cut off positions
    const float skyCutoffDistance = 40.0;
    float maxShiftSpeed = shift;
    float minShiftSpeedFactor = 0.5;

    vec3 cloudOffset = vec3(20.0, 10.0, 20.0);
    vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
    const float k_alphaThreshold = 0.0;

    float baseSeed = seed;
    float timeSeed = baseSeed + 7.0;

    const vec3 cloudShiftDirection = vec3(1,0,0);

    bool cloudSkipArray[MAX_CLOUD_COUNT];

    for (float i = 0.0; i < uCloudSteps; i++) {
      if (color.a < k_alphaThreshold) break;

      float transitionFactor = 5.0;
      float maxTimeShift = 819.2083;
      float maxTimeScale = 3.0;
      // todo: use size scale for random size changes along all dimensions
      //float sizeScale = 0.8;

      float maxDepth = 0.0;
      for (int c = 0; c < cloudCount; ++c)
      {
        float cloudHash = float(c+1);
        vec3 cloudPositionCloud = cloudPosition - 0.5 * cloudOffset + random3D(cloudHash, baseSeed) * cloudOffset;

        float cloudShift = mix(minShiftSpeedFactor * maxShiftSpeed, maxShiftSpeed, abs(random(cloudHash, baseSeed))) * time + random(cloudHash, baseSeed + 37.2) * 3287.102;
        cloudShift = mod(cloudShift, skyCutoffDistance*2.0);

        // changes random seed each time the cloud gets teleported so that we get different variations each time
        int shiftCount = int(cloudShift / (skyCutoffDistance*2.0));
        cloudHash = cloudHash + float(shiftCount) * 13.213;

        float transitionZone = dot(cloudSize*transitionFactor, cloudShiftDirection);
        float alphaBegin = tanh(cloudShift/transitionZone);
        float alphaEnd = tanh((2.0 * skyCutoffDistance - cloudShift) / transitionZone);
        float invAlpha = 1.0/(alphaBegin * alphaEnd);

        cloudPositionCloud += (cloudShift - skyCutoffDistance) * cloudShiftDirection;
    
        float randomTime = randShiftAndScale(time, maxTimeScale, maxTimeShift, timeSeed + cloudHash);
        // early out:
        // size factor: 1 + cloudScatter + (1.0+cloudScatter) * uCloudAnimationStrength + uCloudMinimumDensity
        float maxSize = cmax(cloudSize);
        float ellipse = 1.0 - length(cloudPositionCloud * (invAlpha * invCloudSize));
        if (ellipse + cloudScatter + (1.0+cloudScatter) * uCloudAnimationStrength + uCloudMinimumDensity > 0.0)
        {
          float depth = cloudDepth(cloudPositionCloud, invAlpha * invCloudSize, cloudScatter, cloudShape + 17.213 * random(cloudHash, baseSeed), cloudRoughness, randomTime);
          maxDepth = max(depth, maxDepth);
          cloudSkipArray[c] = false;
        }
        else
        {
          cloudSkipArray[c] = true;
        }
      }

      const float k_DepthThreshold = 0.001;
      if (maxDepth > k_DepthThreshold) {
        vec3 lightPosition = cloudPosition + lightDirection * jitter * shadowStepLength;

        float minShadow = FLT_MAX;
        for (int c = 0; c < cloudCount; ++c)
        {
          if (cloudSkipArray[c])
            continue;

          float cloudHash = float(c+1);
          vec3 lightPositionCloud = lightPosition - 0.5 * cloudOffset + random3D(cloudHash, baseSeed) * cloudOffset;

          float cloudShift = mix(minShiftSpeedFactor * maxShiftSpeed, maxShiftSpeed, abs(random(cloudHash, baseSeed))) * time + random(cloudHash, baseSeed + 37.2) * 3287.102;
          cloudShift = mod(cloudShift, skyCutoffDistance*2.0);

          // changes random seed each time the cloud gets teleported so that we get different variations each time
          int shiftCount = int(cloudShift / (skyCutoffDistance*2.0));
          cloudHash = cloudHash + float(shiftCount) * 13.213;
    
          float transitionZone = dot(cloudSize*transitionFactor, cloudShiftDirection);
          float alphaBegin = tanh(cloudShift/transitionZone);
          float alphaEnd = tanh((2.0 * skyCutoffDistance - cloudShift) / transitionZone);
          float invAlpha = 1.0/(alphaBegin * alphaEnd);
          
          lightPositionCloud += (cloudShift - skyCutoffDistance) * cloudShiftDirection;
       
          float randomTime = randShiftAndScale(time, maxTimeScale, maxTimeShift, timeSeed + cloudHash);

          float shadow = 0.0;
          for (float s = 0.0; s < uShadowSteps; s++) {
            lightPositionCloud += lightDirection * shadowStepLength;
            shadow += cloudDepth(lightPositionCloud, invAlpha * invCloudSize, cloudScatter, cloudShape + 17.213 * random(cloudHash, baseSeed), cloudRoughness, randomTime);
          }
          shadow = exp((-shadow / uShadowSteps) * 3.0);
          minShadow = min(shadow, minShadow);
        }

        // todo: parametrize density factor
        float density = clamp((maxDepth / uCloudSteps) * 20.0, 0.0, 1.0);
        color.rgb += vec3(minShadow * density) * uCloudColor * color.a;
        color.a *= 1.0 - density;

        color.rgb += density * uSkyColor * color.a;
      }

      cloudPosition += ray * stepLength;
    }

    return color;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec4 point = projectionMatrixInverse * vec4(uv * 2.0 - 1.0, -1.0, 1.0);
    vec3 ray = (viewMatrixInverse * vec4(point.xyz, 0)).xyz;
    
    vec4 eyeDir = viewMatrixInverse * normalize(vec4(point.xy, -1, 0.0));  

    // Todo: reevaluate noise. We might not need it anymore.
    // Noise / jitter:
    float defaultHashShape = 43758.5453;
    float jitter = uNoise ? hash(uv.x + uv.y * 50.0 + uTime, defaultHashShape, 0.0, 0.0, 0.0) : 0.0;
      
    vec3 lightDir = normalize(uSunPosition);
          
    float cloudOffset = uCloudOffset;
    float rayShift = cloudOffset;
    vec3 dir = uCameraDirection;
    vec3 cloudPos = uCloudPosition - cloudOffset * dir;
    //gl_FragColor = vec4(uCameraDirection, 1.0);
    //return;

    float turbulence = 0.0;
    vec4 color1 = cloudMarch(uCloudCount, uCloudSeed, jitter, turbulence,
      uCloudSize, uCloudScatter, uCloudShape, uCloudRoughness,
      uTime, uShift,
      cloudPos, lightDir, ray, rayShift);

    vec3 backgroundCloudOffsetVector = uBackgroundCloudOffset * dir + vec3(0.0, uBackgroundCloudUpShift, 0.0);
    float backgroundRayShift = length(backgroundCloudOffsetVector);
    vec3 backgroundCloudPos = cloudPos - backgroundCloudOffsetVector;
    vec3 backgroundCloudSize = uCloudSize * 0.5;
    // todo: hand in transitionZone here so that we can extend it for the far clouds (wider zone along x)
    vec4 color2 = cloudMarch(min(uCloudCount * 2, MAX_CLOUD_COUNT), uCloudSeed + 389.121, jitter, turbulence,
      backgroundCloudSize, uCloudScatter, uCloudShape, uCloudRoughness,
        uTime * 0.25, uShift,
        backgroundCloudPos, lightDir, ray, backgroundRayShift);

    // uniform sky color
    //vec3 skyColor = uSkyColor;
   
    // sky gradient
    float gradientShift = uSkyFadeShift;
    vec3 skyColor = uSkyColor - uSkyFadeFactor * min(0.0, ray.y - gradientShift) * uSkyColorFade;
    // sun center
    float sunIntensity = clamp( dot(lightDir, eyeDir.xyz), 0.0, 1.0 );    
    float maxSunSizePow = 6.0;
    float minSunSizePow = 80.0;
    skyColor += uSunIntensity * uSunColor * pow(sunIntensity, uSunSize * maxSunSizePow + (1.0-uSunSize) * minSunSizePow );

    float cloudDepth = max(1.0-color1.a, 1.0-color2.a);
    vec4 finalColor = mix(vec4(color1.rgb + skyColor * color1.a, 1.0), vec4(color2.rgb + skyColor * color2.a, 1.0), color1.a);
    //vec4 finalColor = vec4(color1.rgb + skyColor * color1.a, 1.0);
    
    // mark cloud pixel
    // Note: cloud depth is encoded in alpha as depth = 1.0 - alpha
    float minCloudDensity = 0.5;
    float cloudPixelFactor = step(minCloudDensity, cloudDepth);

    // sun glare        
    finalColor += uSunIntensity * 1.4 * vec4(0.2, 0.08, 0.04, 1) * pow(sunIntensity, 8.0 );  
        
    gl_FragColor = vec4(min(finalColor.rgb, vec3(1,1,1)), cloudPixelFactor);
    //gl_FragColor = vec4(vec3(cloudPixelFactor), 1.0);

#if 0
    // random test
    vec2 ipos = floor(gl_FragCoord.xy);
    //float seed = sin(floor(uTime * 100.0));
    float seed = sin(uTime);
    float colorR = random(uv.x, seed);
    float colorG = random(uv.y, seed);
    vec3 color = vec3(colorR, colorG, 1.0);
    color = vec3(random(uv, seed));
    gl_FragColor = vec4(color, 1.0);
#endif

    //gl_FragColor = vec4(uv.x, uv.y, 0.0, 1.0);
  }
`;

export const tileVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

export const tileFragmentShader = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tTileAtlasSky;
uniform sampler2D tTileAtlasCloud;
uniform sampler2D tTileAtlasHull;
uniform vec3 uHullColorStart;
uniform float uHullAlphaEnd;
uniform float uHullGradientShift;
uniform float uHullGradientAngle;
uniform float uWindowHeightScale;
uniform float uWindowOffsetScale;
uniform bool uHullDoubleResolution;
uniform bool uFrameDoubleResolution;
uniform bool uCloudDoubleResolution;
uniform bool uSkyDoubleResolution;
uniform float uWindowFrameScale;
uniform vec2 uResolution;
uniform float uTileMixFactor;
uniform float uTime;
uniform int uWindowType;
varying vec2 vUv;

${random}

#define GLSL_PI 3.1415926535897932384626433832795

float minColor(vec3 c)
{
  return min(min(c.r, c.g), c.b);
}

float maxColor(vec3 c)
{
  return max(max(c.r, c.g), c.b);
}

float luminosity(float minColor, float maxColor)
{
  return 0.5 * (minColor + maxColor);
}

float saturation(float minColor, float maxColor, float luminosity)
{
  return luminosity != 1.0 ? (maxColor - minColor) / (1.0 - abs(2.0 * luminosity - 1.0)) : 0.0;
}

float convertHueToRGB(float f1, float f2, float hue)
{
  if (hue < 0.0)
    hue += 1.0;
  else if (hue > 1.0)
    hue -= 1.0;
  float res;
  if ((6.0 * hue) < 1.0)
    res = f1 + (f2 - f1) * 6.0 * hue;
  else if ((2.0 * hue) < 1.0)
    res = f2;
  else if ((3.0 * hue) < 2.0)
    res = f1 + (f2 - f1) * ((2.0 / 3.0) - hue) * 6.0;
  else
    res = f1;
  return res;
}

vec3 convertHSLToRGB(vec3 hsl)
{
  vec3 rgb;

  if (hsl.y == 0.0)
    rgb = vec3(hsl.z, hsl.z, hsl.z);
  else
  {
    float f2;

    if (hsl.z < 0.5)
      f2 = hsl.z * (1.0 + hsl.y);
    else
      f2 = (hsl.z + hsl.y) - (hsl.y * hsl.z);
	
    float f1 = 2.0 * hsl.z - f2;

    rgb.r = convertHueToRGB(f1, f2, hsl.x + (1.0/3.0));
    rgb.g = convertHueToRGB(f1, f2, hsl.x);
    rgb.b = convertHueToRGB(f1, f2, hsl.x - (1.0/3.0));
  }

  return rgb;
}

vec3 convertRGBToHSL(vec3 color)
{
  // hue, saturation, luminance
  vec3 hsl;
	
  float fmin = minColor(color);
  float fmax = maxColor(color);
  float delta = fmax - fmin;

  hsl.z = (fmax + fmin) / 2.0;

  if (delta == 0.0)
  {
    hsl.x = hsl.y = 0.0;
  }
  else
  {
    if (hsl.z < 0.5)
    {
      hsl.y = delta / (fmax + fmin);
    }
    else
    {
      hsl.y = delta / (2.0 - fmax - fmin);
    }

    float deltaR = (((fmax - color.r) / 6.0) + (delta / 2.0)) / delta;
    float deltaG = (((fmax - color.g) / 6.0) + (delta / 2.0)) / delta;
    float deltaB = (((fmax - color.b) / 6.0) + (delta / 2.0)) / delta;

    if (color.r == fmax )
      hsl.x = deltaB - deltaG; // Hue
    else if (color.g == fmax)
      hsl.x = (1.0 / 3.0) + deltaR - deltaB; // Hue
    else if (color.b == fmax)
      hsl.x = (2.0 / 3.0) + deltaG - deltaR; // Hue

    if (hsl.x < 0.0)
      hsl.x += 1.0; // Hue
    else if (hsl.x > 1.0)
      hsl.x -= 1.0; // Hue
  }

  return hsl;
}

vec3 luminosityBlend(vec3 baseColor, vec3 layerColor)
{
  vec3 baseColorHSL = convertRGBToHSL(baseColor);
  return convertHSLToRGB(vec3(baseColorHSL.r, baseColorHSL.g, convertRGBToHSL(layerColor).b));
}

vec3 multiply(vec3 baseColor, vec3 layerColor) {
	return baseColor * layerColor;
}

float overlay(float b, float l) {
	return b < 0.5 ? (2.0 * b * l) : (1.0 - 2.0 * (1.0 - b) * (1.0 - l));
}

vec3 overlay(vec3 baseColor, vec3 layerColor)
{
  return vec3(overlay(baseColor.r, layerColor.r), overlay(baseColor.g, layerColor.g), overlay(baseColor.b, layerColor.b));
}

vec4 overlay(vec4 baseColor, vec4 layerColor)
{
  vec3 color = mix(overlay(baseColor.rgb, layerColor.rgb), baseColor.rgb, layerColor.a);
  return vec4(color, baseColor.a);
}

void main() {
  //gl_FragColor = vec4(vUv,0,1);
  //return;
  vec2 pixelFrac = 1.0 / uResolution;
  vec2 pixelCoord = floor(vUv / pixelFrac);

#if 0
  if (pixelCoord.y < 10.0)
  {
    gl_FragColor = vec4(1.0,0.0,0.0,1.0);

    if (pixelCoord.y < 5.0)
    {
      gl_FragColor = vec4(vUv.x, 0.0, 0.0, 1.0);
    }

    return;
  }
#endif

  // window masking
  float maskAlpha = 0.0;

  vec2 pixelCenterUVScaled = (pixelCoord + 0.5);

  // make sure to position window centered on a pixel to ensure consistent
  // and symmetric outlines all around.
  vec2 windowCenter = uResolution * 0.5;
  windowCenter = floor(windowCenter) + 0.5;

  float windowHeight = uResolution.y * uWindowHeightScale;
  float windowWidth = windowHeight / 2.0;
  float sphereRadius = windowWidth / 3.0;

  if (uWindowType == 0)
  {
    sphereRadius = windowHeight / 3.6;
    windowWidth = sphereRadius * 2.4;
  }
  else if (uWindowType == 1)
  {
    sphereRadius = windowHeight / 3.6;
    windowWidth = sphereRadius * 2.0;
  }
  else if (uWindowType == 2)
  {
    windowWidth = (windowHeight / 6.8) * 5.0;
    sphereRadius = (windowWidth / 5.0) * 1.4;
  }

  float windowOffset = windowWidth * uWindowOffsetScale;
  float windowDistance = windowWidth + windowOffset;
  // make sure to position repeated windows also centered on a pixel by enforcing
  // distances in full pixels only
  windowDistance = floor(windowDistance);

  vec2 windowHalfSize = 0.5 * vec2(windowWidth, windowHeight);
  vec2 sphereCenterUV[4];
  sphereCenterUV[0] = vec2(windowDistance*0.5, windowCenter.y) + vec2(-windowHalfSize.x + sphereRadius, windowHalfSize.y - sphereRadius);
  sphereCenterUV[1] = vec2(windowDistance*0.5, windowCenter.y) + vec2(windowHalfSize.x - sphereRadius, windowHalfSize.y - sphereRadius);
  sphereCenterUV[2] = vec2(windowDistance*0.5, windowCenter.y) + vec2(-windowHalfSize.x + sphereRadius, -windowHalfSize.y + sphereRadius);
  sphereCenterUV[3] = vec2(windowDistance*0.5, windowCenter.y) + vec2(windowHalfSize.x - sphereRadius, -windowHalfSize.y + sphereRadius);

  float pixelCenterCoordRepeatX = mod(pixelCenterUVScaled.x - uResolution.x * 0.5 + windowDistance * 0.5, windowDistance);
  pixelCenterUVScaled = vec2(pixelCenterCoordRepeatX, pixelCenterUVScaled.y);

#if 0
  if (pixelCoord.y < 20.0)
  {
    gl_FragColor = vec4(pixelCenterCoordRepeatX / uResolution.x, 0.0, 0.0, 1.0);
    return;
  }
#endif


  
 
  for (int i = 0; i < 4; ++i)
  {
    maskAlpha = max(maskAlpha, step(length(pixelCenterUVScaled - sphereCenterUV[i]), sphereRadius));  
  }

  // Aabb format: vec4(min_x, min_y, max_x, max_y)
  vec4 rectAabbUV[2];
  rectAabbUV[0] = vec4(sphereCenterUV[2].x - sphereRadius, sphereCenterUV[2].y,
    sphereCenterUV[1].x + sphereRadius, sphereCenterUV[1].y);
  rectAabbUV[1] = vec4(sphereCenterUV[2].x, sphereCenterUV[2].y - sphereRadius,
    sphereCenterUV[1].x, sphereCenterUV[1].y + sphereRadius);

  for (int i = 0; i < 2; ++i)
  {
    vec4 aabb = rectAabbUV[i];
    vec2 minAabb = vec2(aabb.x, aabb.y);
    vec2 maxAabb = vec2(aabb.z, aabb.w);
    vec2 minStep = step(minAabb, pixelCenterUVScaled);
    vec2 maxStep = step(pixelCenterUVScaled, maxAabb);
    maskAlpha = max(maskAlpha, min(minStep.x, min(minStep.y, min(maxStep.x, maxStep.y))));
  }

  // window frame:
  float scaledWindowMaskAlpha = 0.0;
  float sphereRadiusScaled = sphereRadius * (1.0 + uWindowFrameScale);
  for (int i = 0; i < 4; ++i)
  {
    scaledWindowMaskAlpha = max(scaledWindowMaskAlpha, step(length(pixelCenterUVScaled - sphereCenterUV[i]), sphereRadiusScaled));  
  }

  // Aabb format: vec4(min_x, min_y, max_x, max_y)
  vec4 rectAabbUVScaled[2];
  rectAabbUVScaled[0] = vec4(sphereCenterUV[2].x - sphereRadiusScaled, sphereCenterUV[2].y,
    sphereCenterUV[1].x + sphereRadiusScaled, sphereCenterUV[1].y);
  rectAabbUVScaled[1] = vec4(sphereCenterUV[2].x, sphereCenterUV[2].y - sphereRadiusScaled,
    sphereCenterUV[1].x, sphereCenterUV[1].y + sphereRadiusScaled);

  for (int i = 0; i < 2; ++i)
  {
    vec4 aabb = rectAabbUVScaled[i];
    vec2 minAabb = vec2(aabb.x, aabb.y);
    vec2 maxAabb = vec2(aabb.z, aabb.w);
    vec2 minStep = step(minAabb, pixelCenterUVScaled);
    vec2 maxStep = step(pixelCenterUVScaled, maxAabb);
    scaledWindowMaskAlpha = max(scaledWindowMaskAlpha, min(minStep.x, min(minStep.y, min(maxStep.x, maxStep.y))));
  }

  float hullFactor = 1.0 - maskAlpha;
  float frameFactor = scaledWindowMaskAlpha;

  vec2 texelLookup = pixelCoord * pixelFrac + 0.5 * pixelFrac;
  vec4 texel = texture2D( tDiffuse, texelLookup );

  // 2-pass emoji lookup with sky vs. cloud distinction
  // First check if the pixel should be forced to be a cloud or sky pixel based on its saturation.
  // For high low saturation, we want cloud emojis.
  // For the rest we can use either (mixed emoji tile set)
  float minColor = minColor(texel.rgb);
  float maxColor = maxColor(texel.rgb);
  float luminosity = luminosity(minColor, maxColor);

  float cloudFlag = texel.a; // 0.0 if texel is sky (not cloud)
  float forceCloudFactor = 2.0 - cloudFlag;

  // simple emoji lookup with brightness only
  // compute brightness of texel
  vec3 luminanceWeights = vec3(0.299, 0.587, 0.114);
  float luminance = dot(luminanceWeights, texel.rgb);

  const int kTileSetCount = 16;
  const float kTileSetCountF = float(kTileSetCount);
  const float kMaxCoordX = 1.0 / kTileSetCountF;

  vec2 uvLookup = vUv * uResolution;
  uvLookup.x /= kTileSetCountF;
  uvLookup.x = mod(uvLookup.x, kMaxCoordX);

  int tileIndex = int(mod((1.0-luminance) * kTileSetCountF, kTileSetCountF));
  if (hullFactor == 1.0)
  {
    // reset mask to render the tile
    maskAlpha = 1.0;

    // always pick center tile on which random offset is added below
    const int kHullTileIndex = kTileSetCount / 2;
    tileIndex = kHullTileIndex;
    texel.rgb = uHullColorStart;

    // double tile resolution for hull and frame
    if (frameFactor == 1.0)
    {
      uvLookup = mix(uvLookup, uvLookup * 2.0, float(int(uFrameDoubleResolution)));      
    }
    else
    {
      uvLookup = mix(uvLookup, uvLookup * 2.0, float(int(uHullDoubleResolution)));
    }
  }
  
  // todo: add parameters for noise tile offset range and for strength
  float seed = sin(floor(uTime * 20.0));
  float noise = 1.0 - 2.0 * random(texelLookup, seed); // in [-1,1]

  const float kMaxNoiseTileOffsetFactor = 1.0;
  const float kMaxNoiseTileOffset = ceil(kMaxNoiseTileOffsetFactor * kTileSetCountF);
#if 0  
  // different noise offset factors for hull vs sky (full for hull)
  const float kMaxNoiseTileOffsetHull = kTileSetCountF / 2.0;
  float tileOffset = mix(kMaxNoiseTileOffset, kMaxNoiseTileOffsetHull, hullFactor) * noise;
#else
  float tileOffset = kMaxNoiseTileOffset * noise;
#endif

  int finalTileIndex = tileIndex + int(tileOffset);
  finalTileIndex = max(0, min(finalTileIndex, kTileSetCount-1));
  uvLookup.x += float(finalTileIndex) * kMaxCoordX;

  vec4 tile;
  if (hullFactor == 1.0)
  {
    tile = texture2D( tTileAtlasHull, uvLookup);
  }
  else
  {
    if (int(cloudFlag) != 0)
    {
      uvLookup = mix(uvLookup, uvLookup * 2.0, float(int(uCloudDoubleResolution)));
      tile = texture2D( tTileAtlasCloud, uvLookup);
    }
    else
    {
      uvLookup = mix(uvLookup, uvLookup * 2.0, float(int(uSkyDoubleResolution)));
      tile = texture2D( tTileAtlasSky, uvLookup);
    }
  }

#if 0
  // desaturate tile if it is cloud
  tile.rgb = mix(tile.rgb, vec3(dot(tile.rgb, luminanceWeights)), cloudFlag);
#elif 1
  // always desaturate
  tile.rgb = vec3(dot(tile.rgb, luminanceWeights));
#endif

  // display blend of texel and tiles
  vec4 blendColor;
#if 0 // multiply blend
  //gl_FragColor = overlay(tile, vec4(texel.rgb, uTileMixFactor));
  //gl_FragColor.rgb = mix(texel.rgb, multiply(tile.rgb, texel.rgb), uTileMixFactor);

  // todo: in this mode, use smooth gradient rather than blocky gradient
  blendColor = vec4(mix(multiply(tile.rgb, texel.rgb), tile.rgb, uTileMixFactor), 1);
#elif 0 // linear interpolation
  blendColor = mix(texel, tile, uTileMixFactor);
#elif 0 // luminosity blend
  blendColor = vec4(luminosityBlend(texel.rgb, tile.rgb), 1);
#else // overlay blend
  blendColor = vec4(overlay(tile.rgb, texel.rgb), 1);
#endif

  if (hullFactor == 1.0)
  {
    float gradientAngle = radians(uHullGradientAngle);
    vec2 gradientNormal = vec2(sin(gradientAngle), cos(gradientAngle));
    float gradientOffset = dot(gradientNormal, vec2(0.5, 0.5));
    float gradientAlpha = 0.5 - dot(gradientNormal, vUv) + gradientOffset;
    gradientAlpha += uHullGradientShift;
    gradientAlpha = mix(1.0 - gradientAlpha, gradientAlpha, scaledWindowMaskAlpha);

    gradientAlpha = max(0.0, min(gradientAlpha, 1.0));

    vec4 colorEnd = mix(vec4(1), blendColor, uHullAlphaEnd);
    blendColor = mix(vec4(colorEnd.rgb, 1), blendColor, gradientAlpha);
  }

  blendColor = mix(vec4(1), blendColor, maskAlpha);

  // show mix between texel and blend (see above)
  float tileMixFactor = mix(uTileMixFactor, 1.0, hullFactor);
  gl_FragColor = mix(texel, blendColor, tileMixFactor);

  // show mix between texel and tile
  //gl_FragColor = mix(texel, tile, uTileMixFactor);
  
  // todo: get 2 mix factor ranges so that we can show only rendering, or only tiles or only blend result

  // show only tile
  //gl_FragColor = tile;
  
  // show only texel
  //gl_FragColor = texel;

  //gl_FragColor = vec4(1.0,0.0,0.0,1.0);
}
`;

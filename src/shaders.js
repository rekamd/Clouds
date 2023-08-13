export const random = /* glsl */ `
float random(float x, float seed)
{
  return fract(sin(x * (seed + 78.233))*(43758.5453123 + seed));
}

float random(vec2 st, float seed)
{
  return fract(sin(dot(st, vec2(seed + 12.9898, seed + 78.233))) * (43758.5453123 + seed));
}
`;

export const cloudFragmentShader = /* glsl */ `

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
  uniform vec3 uCameraPosition;
  uniform vec3 uCloudColor;
  uniform vec3 uSkyColor;
  uniform float uCloudSteps;
  uniform float uShadowSteps;
  uniform float uCloudLength;
  uniform float uShadowLength;
  uniform vec2 uResolution;
  uniform mat4 projectionMatrixInverse;
  uniform mat4 viewMatrixInverse;
  uniform float uTime;
  uniform bool uNoise;
  uniform float uTurbulence;
  uniform float uShift;

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
    return fract((sin(n) + cos(n)) * shape) + animationStrength * pow(sin((time * animationSpeed)/3.0), 5.0);
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
    f += 0.5000 * noise(p, shape, time); p = m * p * (r + 2.0 * t);
    f += 0.2500 * noise(p, shape, time); p = m * p * (r + 3.0 * t);
    f += 0.12500 * noise(p, shape, time); p = m * p * (r + t);
    f += 0.06250 * noise(p, shape, time);
    return f;
  }

  float cloudDepth(vec3 position, vec3 cloudSize, float cloudScatter, float cloudShape, float cloudRoughness, float time) {
    float ellipse = 1.0 - length(position * cloudSize);
    float cloud = ellipse + fbm(position, cloudShape, cloudRoughness, time) * cloudScatter + uCloudMinimumDensity;

    return min(max(0.0, cloud), 1.0);
  }

  // https://shaderbits.com/blog/creating-volumetric-ray-marcher
  vec4 cloudMarch(float jitter, float turbulence, vec3 cloudSize, float cloudScatter, float cloudShape, float cloudRoughness, float time, vec3 position, vec3 lightDirection, vec3 ray) {
    float stepLength = uCloudLength / uCloudSteps;
    float shadowStepLength = uShadowLength / uShadowSteps;

    vec3 cloudPosition = position + ray * turbulence * stepLength;

    vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
    const float k_alphaThreshold = 0.0;
    for (float i = 0.0; i < uCloudSteps; i++) {
      if (color.a < k_alphaThreshold) break;

      float depth = cloudDepth(cloudPosition, cloudSize, cloudScatter, cloudShape, cloudRoughness, time);
      const float k_DepthThreshold = 0.001;
      float depthTest = float(depth > k_DepthThreshold);
      if (depth > k_DepthThreshold) {
        vec3 lightPosition = cloudPosition + lightDirection * jitter * shadowStepLength;

        float shadow = 0.0;
        for (float s = 0.0; s < uShadowSteps; s++) {
          lightPosition += lightDirection * shadowStepLength;
          shadow += cloudDepth(lightPosition, cloudSize, cloudScatter, cloudShape, cloudRoughness, time);
        }
        shadow = exp((-shadow / uShadowSteps) * 3.0);

        float density = clamp((depth / uCloudSteps) * 20.0, 0.0, 1.0);
        color.rgb += vec3(shadow * density) * uCloudColor * color.a;
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

    // Noise / jitter:
    float defaultHashShape = 43758.5453;
    float jitter = uNoise ? hash(uv.x + uv.y * 50.0 + uTime, defaultHashShape, 0.0, 0.0, 0.0) : 0.0;

    // Turbulence:
    // Todo: could mix two sin or two fruct turbulences which are shifted by 50%,
    // or overlay one cos and one sin turbulence to create a proper loop without reset or reverse effects.

    // This below works fine but for values larger zero the clouds eventually disappear and never reappear
    // and the whole effect is view angle dependent (turbulence is a shift along the sun ray)
    //float turbulence = uTime * uTurbulence;

    // this below works fine but the fract function causes a sort of "reset" effect at certain moments
    // and the turbulence is still view-angle dependent.
    float turbulence = fract(uTime * uTurbulence); /* * optionalTurbulenceStrength */;

    // this below didn't work. The sin function causes a sort of "reverse" effect which looks unnatural
    // Idea was to reform the clouds eventually, but they reform in reverse which makes no sense.
    //float turbulenceSpeed = 10.0;
    //float turbulence = sin((uTime * turbulenceSpeed)) * uTurbulence;

    // some attempt of overlaying sin and cos which leads to some forward/reverse effect
    //float turbulence = (1.0 + sin(uTime) * cos(uTime)) * uTurbulence;
      
    vec3 lightDir = normalize(uSunPosition);
          
    vec3 cloudPos = uCameraPosition;
    float shiftSpeed = uShift;
    float skyCutoff = 25.0;
    float cloudShift = shiftSpeed * uTime;
    cloudShift = mod(cloudShift, skyCutoff*2.0);
    vec3 cloudShiftDirection = vec3(1,0,0);
    cloudPos += (cloudShift - skyCutoff) * cloudShiftDirection;

    vec4 color1 = cloudMarch(jitter, turbulence, uCloudSize, uCloudScatter, uCloudShape, uCloudRoughness, uTime, cloudPos, lightDir, ray);   
    vec4 color2 = cloudMarch(jitter, turbulence, uCloudSize * vec3(1.5,2.0,1.5), uCloudScatter, uCloudShape, uCloudRoughness, uTime, cloudPos + vec3(3.0,-3.0,-1), lightDir, ray);
    
    // uniform sky color
    //vec3 skyColor = uSkyColor;
   
    // sky gradient
    float heightFactor = 0.5;
    vec3 skyColor = uSkyColor - heightFactor * ray.y * vec3(1.0,0.5,1.0) + 0.3*vec3(0.5);
    // sun center
    float sunIntensity = clamp( dot(lightDir, eyeDir.xyz), 0.0, 1.0 );    
    float maxSunSizePow = 6.0;
    float minSunSizePow = 80.0;
    skyColor += uSunIntensity * vec3(1.0, 0.6, 0.1) * pow(sunIntensity, uSunSize * maxSunSizePow + (1.0-uSunSize) * minSunSizePow );
    
    vec4 finalColor;
    //finalColor = vec4(color.rgb + skyColor * color.a, 1.0);
    // two clouds option 1:
    //finalColor = vec4(color1.rgb * (1.0-color1.a) + color2.rgb * (1.0-color2.a) + skyColor * min((color1.a + color2.a)/2.0, 1.0), 1.0);
    // two clouds option 2:
    //finalColor = vec4(color1.rgb * (1.0-color1.a) + color2.rgb * (1.0-color2.a) + skyColor * min(color1.a + color2.a, 1.0), 1.0);
    // two clouds option 3 (same as above):
    //finalColor = vec4(color1.rgb + color2.rgb + skyColor * min(color1.a + color2.a, 1.0), 1.0);
    // two clouds option 4 (linear interpolation; todo: what if the clouds overlap? could do CSG style: choose color of cloud which is denser):
    finalColor = mix(vec4(color1.rgb + skyColor * color1.a, 1.0), vec4(color2.rgb + skyColor * color2.a, 1.0), color1.a);

    // Note: approach likely faster and easier to render properly if we work the multiple cloud support into the cloudMarch function.
    
    // sun glare        
    finalColor += 1.4 * vec4(0.2, 0.08, 0.04, 1) * pow(sunIntensity, 8.0 );  
        
    gl_FragColor = finalColor;

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

    //gl_FragColor = vec4(1,0,0,1);
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
uniform sampler2D tTiles;
uniform sampler2D tTileAtlas;
uniform bool uUVTest;
uniform vec2 uResolution;
uniform float uTileMixFactor;
varying vec2 vUv;

${random}

float minColor(vec3 c)
{
  return min(min(c.r, c.g), c.b);
  //return min(0.5 * (c.r + c.g), c.b);
}

float maxColor(vec3 c)
{
  return max(max(c.r, c.g), c.b);
  //return max(0.5 * (c.r + c.g), c.b);
}

float luminosity(float minColor, float maxColor)
{
  return 0.5 * (minColor + maxColor);
}

float saturation(float minColor, float maxColor, float luminosity)
{
  return luminosity != 1.0 ? (maxColor - minColor) / (1.0 - abs(2.0 * luminosity - 1.0)) : 0.0;
}

void main() {
  vec2 pixelFrac = 1.0 / uResolution;
  vec2 pixelCoord = floor(vUv / pixelFrac);
  vec2 texelLookup = pixelCoord * pixelFrac + 0.5 * pixelFrac;
  vec4 texel = texture2D( tDiffuse, texelLookup );

  // 2-pass emoji lookup with sky vs. cloud distinction
  // First check if the pixel should be forced to be a cloud or sky pixel based on its saturation.
  // For high low saturation, we want cloud emojis.
  // For the rest we can use either (mixed emoji tile set)
  float minColor = minColor(texel.rgb);
  float maxColor = maxColor(texel.rgb);
  float luminosity = luminosity(minColor, maxColor);
  float saturation = saturation(minColor, maxColor, luminosity);

  bool forceCloud = saturation < 0.8;

  // simple emoji lookup with brightness only
  // compute brightness of texel
  //float luminance = (texel.r + texel.g + texel.b) / 3.0;
  //float luminance = 0.2126*texel.r + 0.7152*texel.g + 0.0722*texel.b;
  float luminance = 0.299*texel.r + 0.587*texel.g + 0.114*texel.b;
  //float luminance = sqrt( 0.299*texel.r*texel.r + 0.587*texel.g*texel.g + 0.114*texel.b*texel.b );

  vec2 uvLookup = vUv * uResolution;
  int tileCount = 32;
  uvLookup.x /= float(tileCount);
  float maxCoordX = 1.0 / float(tileCount);
  uvLookup.x = mod(uvLookup.x, maxCoordX);
  int chosenTileSetCount = forceCloud ? 16 : 32;
  int tileIndex = int(mod((1.0-luminance) * float(chosenTileSetCount), float(chosenTileSetCount)));
  uvLookup.x += float(tileIndex) * maxCoordX;

  //vec4 tile = texture2D( tTiles, vUv * uResolution);
  vec4 tile = texture2D( tTileAtlas, uvLookup);

  // mix in uv test color
  texel.r += float(uUVTest) * vUv.x;
  texel.g += float(uUVTest) * vUv.y;
  //gl_FragColor = texel;

  // display luminosity
  //gl_FragColor = vec4(vec3(luminosity), 1.0);
  
  // display saturation
  vec4 saturationColor = vec4(vec3(saturation), 1.0);
  
  //gl_FragColor = saturationColor;
  //gl_FragColor = mix(texel, saturationColor, 0.5);

  // display 50/50 mix of texel and emoji
  gl_FragColor = mix(texel, tile, uTileMixFactor);
  
  // show only emoji
  //gl_FragColor = tile;
  
  // show only texel
  //gl_FragColor = texel;
}
`;

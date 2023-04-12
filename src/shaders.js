// 3D FBM noise https://shadertoy.com/view/lss3zr
export const fbm = /* glsl */ `
  mat3 m = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
  float hash(float n) {
    // Todo: parameterize constant here
    return fract(sin(n) * 43758.5453);
  }

  float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);

    f = f * f * (3.0 - 2.0 * f);

    float n = p.x + p.y * 57.0 + 113.0 * p.z;

    // Todo: noise function constants can be used for different looks
    float res = mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                        mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
                    mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                        mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
    return res;
  }

  float fbm(vec3 p) {
    float f = 0.0;
    f += 0.5000 * noise(p); p = m * p * 2.02;
    f += 0.2500 * noise(p); p = m * p * 2.03;
    f += 0.12500 * noise(p); p = m * p * 2.01;
    f += 0.06250 * noise(p);
    return f;
  }
`;

export const fragmentShader = /* glsl */ `
  ${fbm}

  uniform vec3 uCloudSize;
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

  float cloudDepth(vec3 position, vec3 cloudSize) {
    float ellipse = 1.0 - length(position * cloudSize);
    float cloud = ellipse + fbm(position) * 2.2;

    return min(max(0.0, cloud), 1.0);
  }

  // https://shaderbits.com/blog/creating-volumetric-ray-marcher
  vec4 cloudMarch(float jitter, float turbulence, vec3 cloudSize, vec3 position, vec3 ray) {
    float stepLength = uCloudLength / uCloudSteps;
    float shadowStepLength = uShadowLength / uShadowSteps;

    vec3 lightDirection = normalize(uSunPosition);
    vec3 cloudPosition = position + ray * turbulence * stepLength;

    vec4 color = vec4(0.0, 0.0, 0.0, 1.0);

    for (float i = 0.0; i < uCloudSteps; i++) {
      if (color.a < 0.1) break; // Todo: avoid if in shader

      float depth = cloudDepth(cloudPosition, cloudSize);
      if (depth > 0.001) { // Todo: avoid if in shader
        vec3 lightPosition = cloudPosition + lightDirection * jitter * shadowStepLength;

        float shadow = 0.0;
        for (float s = 0.0; s < uShadowSteps; s++) {
          lightPosition += lightDirection * shadowStepLength;
          shadow += cloudDepth(lightPosition, cloudSize);
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

    float jitter = uNoise ? hash(uv.x + uv.y * 50.0 + uTime) : 0.0;
    //float jitter = uNoise ? sin(uTime) : 0.0; //hash(uv.x + uv.y * 50.0 + uTime) : 0.0;
    //float turbulence = uTurbulence ? sin(uTime) + cos(uTime) : 0.0;
    float turbulence = fract(uTime * uTurbulence);

    vec3 cloudPos = uCameraPosition;
    float shiftSpeed = uShift;
    float skyCutoff = 25.0;
    float cloudShift = shiftSpeed * uTime;
    cloudShift = mod(cloudShift, skyCutoff*2.0);
    vec3 cloudShiftDirection = vec3(1,0,0);
    cloudPos += (cloudShift - skyCutoff) * cloudShiftDirection;
    vec4 color1 = cloudMarch(jitter, turbulence, uCloudSize, cloudPos, ray);   
    vec4 color2 = cloudMarch(jitter, turbulence, uCloudSize * vec3(1.5,2.0,1.5), cloudPos + vec3(3.0,-3.0,-1), ray);
    //float t = mod(uTime, 60.0);
    //gl_FragColor = vec4(t / 60.0, 1.0, 1.0, 1.0);
    //gl_FragColor = vec4(1.0,0.0,0.0,1.0);
    vec3 skyColor = uSkyColor;
    //vec3 skyColor = vec3(t / 60.0, 1.0, 1.0);
    
    //gl_FragColor = vec4(color.rgb + skyColor * color.a, 1.0);
    // two clouds option 1:
    //gl_FragColor = vec4(color1.rgb * (1.0-color1.a) + color2.rgb * (1.0-color2.a) + skyColor * min((color1.a + color2.a)/2.0, 1.0), 1.0);
    // two clouds option 2:
    //gl_FragColor = vec4(color1.rgb * (1.0-color1.a) + color2.rgb * (1.0-color2.a) + skyColor * min(color1.a + color2.a, 1.0), 1.0);
    // two clouds option 3 (same as above):
    //gl_FragColor = vec4(color1.rgb + color2.rgb + skyColor * min(color1.a + color2.a, 1.0), 1.0);
    // two clouds option 4 (linear interpolation; todo: what if the clouds overlap? could do CSG style: choose color of cloud which is denser):
    gl_FragColor = mix(vec4(color1.rgb + skyColor * color1.a, 1.0), vec4(color2.rgb + skyColor * color2.a, 1.0), color1.a);
    
    // Note: approach likely faster and easier to render properly if we work the multiple cloud support into the cloudMarch function.
  }
`;

// 3D FBM noise https://shadertoy.com/view/lss3zr
export const fbm = /* glsl */ `

  // Todo: animate the noise below, size and uniformity can be changed over time
  mat3 m = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
  float hash(float n, float shape) {
    return fract( (sin(n) + cos(n)) * shape);
  }

  float noise(vec3 x, float shape) {
    vec3 p = floor(x);
    vec3 f = fract(x);

    f = f * f * (3.0 - 2.0 * f);

    // Todo: parameterize magic numbers (same as below). These seem to be offsets.
    float n = p.x + p.y * 57.0 + 113.0 * p.z;
    // Variation A
    //float n = p.x + p.y * 5.0 + 23.0 * p.z;
    // Variation B
    //float n = 123.0 * p.x + p.y * 2321.0 + 50017.0 * p.z;

    // Todo: noise function constants can be used for different looks
    float res = mix(mix(mix(hash(n + 0.0, shape), hash(n + 1.0, shape), f.x),
                        mix(hash(n + 57.0, shape), hash(n + 58.0, shape), f.x), f.y),
                    mix(mix(hash(n + 113.0, shape), hash(n + 114.0, shape), f.x),
                        mix(hash(n + 170.0, shape), hash(n + 171.0, shape), f.x), f.y), f.z);

    // Variation A
    //float res = mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
    //                    mix(hash(n + 5.0), hash(n + 6.0), f.x), f.y),
    //                mix(mix(hash(n + 23.0), hash(n + 24.0), f.x),
    //                    mix(hash(n + 50.0), hash(n + 51.0), f.x), f.y), f.z);

    // Variation B
    //float res = mix(mix(mix(hash(n + 123.0), hash(n + 124.0), f.x),
    //                    mix(hash(n + 2321.0), hash(n + 2322.0), f.x), f.y),
    //                mix(mix(hash(n + 50017.0), hash(n + 50018.0), f.x),
    //                    mix(hash(n + 100231.0), hash(n + 100232.0), f.x), f.y), f.z);

    // Todo: this version creates visible bands
    //float res = mix(mix(mix(hash(n + 0.0), hash(n + 56.0), f.x),
    //                    mix(hash(n + 57.0), hash(n + 112.0), f.x), f.y),
    //                mix(mix(hash(n + 113.0), hash(n + 169.0), f.x),
    //                    mix(hash(n + 170.0), hash(n + 200.0), f.x), f.y), f.z);

    // Todo: this version leads to a rougher look but also some chaotic artifacts,
    // likely since it is not coordinates with the magic numbers above
    //float res = mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
    //                    mix(hash(n + 222.0), hash(n + 323.0), f.x), f.y),
    //                mix(mix(hash(n + 1130.0), hash(n + 1138.0), f.x),
    //                    mix(hash(n + 17.0), hash(n + 19.0), f.x), f.y), f.z);

    return res;
  }

  float fbm(vec3 p, float shape, float roughness) {
    float f = 0.0;
    float r = roughness;
    float t = 0.01;
    //float r = 3.0;
    //float t = -0.05;
    f += 0.5000 * noise(p, shape); p = m * p * (r + 2.0 * t);
    f += 0.2500 * noise(p, shape); p = m * p * (r + 3.0 * t);
    f += 0.12500 * noise(p, shape); p = m * p * (r + t);
    f += 0.06250 * noise(p, shape);
    return f;
  }
`;

export const fragmentShader = /* glsl */ `
  ${fbm}

  uniform vec3 uCloudSize;
  uniform float uCloudScatter;
  uniform float uCloudShape;
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

  float cloudDepth(vec3 position, vec3 cloudSize, float cloudScatter, float cloudShape) {
    float ellipse = 1.0 - length(position * cloudSize);
    float roughness = 2.0;
    float cloud = ellipse + fbm(position, cloudShape, roughness) * cloudScatter;

    return min(max(0.0, cloud), 1.0);
  }

  // https://shaderbits.com/blog/creating-volumetric-ray-marcher
  vec4 cloudMarch(float jitter, float turbulence, vec3 cloudSize, float cloudScatter, float cloudShape, vec3 position, vec3 lightDirection, vec3 ray) {
    float stepLength = uCloudLength / uCloudSteps;
    float shadowStepLength = uShadowLength / uShadowSteps;

    vec3 cloudPosition = position + ray * turbulence * stepLength;

    vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
    const float k_alphaThreshold = 0.0;
    for (float i = 0.0; i < uCloudSteps; i++) {
      if (color.a < k_alphaThreshold) break;

      float depth = cloudDepth(cloudPosition, cloudSize, cloudScatter, cloudShape);
      const float k_DepthThreshold = 0.001;
      float depthTest = float(depth > k_DepthThreshold);
      if (depth > k_DepthThreshold) {
        vec3 lightPosition = cloudPosition + lightDirection * jitter * shadowStepLength;

        float shadow = 0.0;
        for (float s = 0.0; s < uShadowSteps; s++) {
          lightPosition += lightDirection * shadowStepLength;
          shadow += cloudDepth(lightPosition, cloudSize, cloudScatter, cloudShape);
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
    float jitter = uNoise ? hash(uv.x + uv.y * 50.0 + uTime, defaultHashShape) : 0.0;

    // Turbulence:
    // Todo: could mix two sin or two fruct turbulences which are shifted by 50%,
    // or overlay one cos and one sin turbulence to create a proper loop without reset or reverse effects.

    // This below works fine but for values larger zero the clouds eventually disappear and never reappear
    // and the whole effect is view angle dependent (turbulence is a shift along the sun ray)
    //float turbulence = uTime * uTurbulence;

    // this below works fine but the the fract function causes a sort of "reset" effect at certain moments
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

    vec4 color1 = cloudMarch(jitter, turbulence, uCloudSize, uCloudScatter, uCloudShape, cloudPos, lightDir, ray);   
    vec4 color2 = cloudMarch(jitter, turbulence, uCloudSize * vec3(1.5,2.0,1.5), uCloudScatter, uCloudShape, cloudPos + vec3(3.0,-3.0,-1), lightDir, ray);
    
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

    //gl_FragColor = vec4(1,0,0,1);
  }
`;

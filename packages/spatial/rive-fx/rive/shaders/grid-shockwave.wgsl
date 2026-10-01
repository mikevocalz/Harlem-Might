// Grid FX Ultra shockwave shader.
// Experimental source for Rive GPU Canvas-capable runtimes. The production
// baseline remains scene.rml and must not depend on this file.
//
// Uniform rows:
//   a = resolution.xy, timeSeconds, intensity
//   b = center.xy (UV), radius, width
//   c = playerColor.rgb, chromaticAmount
struct GridFxUniforms {
  a: vec4f,
  b: vec4f,
  c: vec4f,
};

@group(0) @binding(0) var<uniform> u: GridFxUniforms;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  var p = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(3.0, -1.0),
    vec2f(-1.0, 3.0)
  );
  var out: VSOut;
  out.pos = vec4f(p[vi], 0.0, 1.0);
  out.uv = vec2f(p[vi].x * 0.5 + 0.5, 1.0 - (p[vi].y * 0.5 + 0.5));
  return out;
}

fn ring(distance: f32, radius: f32, width: f32) -> f32 {
  return exp(-pow((distance - radius) / max(width, 0.001), 2.0));
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let resolution = max(u.a.xy, vec2f(1.0));
  let t = u.a.z;
  let intensity = clamp(u.a.w, 0.0, 1.0);
  let center = u.b.xy;
  let radius = u.b.z;
  let width = max(u.b.w, 0.002);

  let aspect = resolution.x / resolution.y;
  var q = in.uv - center;
  q.x *= aspect;
  let d = length(q);

  let wave = ring(d, radius, width);
  let echo = ring(d, radius * 0.72, width * 0.45) * 0.35;
  let scan = 0.5 + 0.5 * sin((d * 180.0) - t * 18.0);

  let cyan = max(u.c.rgb, vec3f(0.0));
  let white = vec3f(1.0);
  let core = mix(cyan, white, clamp(wave * 1.4, 0.0, 1.0));
  let alpha = clamp((wave + echo) * (0.65 + scan * 0.35) * intensity, 0.0, 1.0);

  // The host compositor can use wave * c.w as a radial UV distortion amount.
  // This pass stays color-only so the source remains valid without a sampled
  // background texture.
  return vec4f(core * (1.0 + wave * 1.8), alpha);
}

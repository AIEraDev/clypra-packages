/**
 * @clypra-studio/shaders — Body Mask Conditioning WGSL Chunks
 *
 * Canonical 9-tap separable Gaussian and morphological choke/dilate
 * filter routines for WebGPU shader authoring.
 */

export const wgslBodyMaskConditioning = `
struct MaskConditioning {
    center: f32,
    gaussian_smooth: f32,
    eroded: f32,   // Local minimum (morphological choke)
    dilated: f32,  // Local maximum (morphological spread)
};

// High-precision 9-tap separable Gaussian and morphological filter.
// Eliminates neural segmentation pixel stepping, clothing haloing, and edge buzz.
fn condition_body_mask_impl(
    uv: vec2<f32>,
    radius_px: f32,
    mask_dims: vec2<f32>,
    sample_fn: fn(vec2<f32>) -> f32
) -> MaskConditioning {
    let texel = 1.0 / max(mask_dims, vec2<f32>(1.0));
    let offset = texel * max(radius_px, 1.0);

    let m_c = sample_fn(uv);
    var min_val = m_c;
    var max_val = m_c;

    // 4 Cardinal samples:
    let m_r = sample_fn(uv + vec2<f32>(offset.x, 0.0));
    let m_l = sample_fn(uv - vec2<f32>(offset.x, 0.0));
    let m_t = sample_fn(uv + vec2<f32>(0.0, offset.y));
    let m_b = sample_fn(uv - vec2<f32>(0.0, offset.y));

    min_val = min(min_val, min(min(m_r, m_l), min(m_t, m_b)));
    max_val = max(max_val, max(max(m_r, m_l), max(m_t, m_b)));

    // 4 Diagonal samples (0.7071 factor for radial symmetry):
    let diag = offset * 0.7071068;
    let m_tr = sample_fn(uv + vec2<f32>(diag.x, diag.y));
    let m_tl = sample_fn(uv + vec2<f32>(-diag.x, diag.y));
    let m_br = sample_fn(uv + vec2<f32>(diag.x, -diag.y));
    let m_bl = sample_fn(uv + vec2<f32>(-diag.x, -diag.y));

    min_val = min(min_val, min(min(m_tr, m_tl), min(m_br, m_bl)));
    max_val = max(max_val, max(max(m_tr, m_tl), max(m_br, m_bl)));

    // 9-Tap Normalized Gaussian Weighted Kernel (Sum = 0.9998 ≈ 1.0):
    let gaussian = m_c * 0.2042 +
        (m_r + m_l + m_t + m_b) * 0.1238 +
        (m_tr + m_tl + m_br + m_bl) * 0.0751;

    var result: MaskConditioning;
    result.center = m_c;
    result.gaussian_smooth = gaussian;
    result.eroded = min_val;
    result.dilated = max_val;
    return result;
}
`;

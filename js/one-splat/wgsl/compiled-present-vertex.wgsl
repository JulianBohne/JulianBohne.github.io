const uvs_0 : array<vec2<f32>, i32(6)> = array<vec2<f32>, i32(6)>( vec2<f32>(0.0f, 1.0f), vec2<f32>(1.0f, 1.0f), vec2<f32>(1.0f, 0.0f), vec2<f32>(1.0f, 0.0f), vec2<f32>(0.0f, 0.0f), vec2<f32>(0.0f, 1.0f) );
const pos_0 : array<vec2<f32>, i32(6)> = array<vec2<f32>, i32(6)>( vec2<f32>(-1.0f, -1.0f), vec2<f32>(1.0f, -1.0f), vec2<f32>(1.0f, 1.0f), vec2<f32>(1.0f, 1.0f), vec2<f32>(-1.0f, 1.0f), vec2<f32>(-1.0f, -1.0f) );
struct VOut_0
{
    @builtin(position) position_0 : vec4<f32>,
    @location(0) uv_0 : vec2<f32>,
};

fn VOut_x24init_0( position_1 : vec4<f32>,  uv_1 : vec2<f32>) -> VOut_0
{
    var _S1 : VOut_0;
    _S1.position_0 = position_1;
    _S1.uv_0 = uv_1;
    return _S1;
}

@vertex
fn vert(@builtin(vertex_index) vertexIndex_0 : u32) -> VOut_0
{
    return VOut_x24init_0(vec4<f32>(pos_0[vertexIndex_0], 0.0f, 1.0f), uvs_0[vertexIndex_0]);
}

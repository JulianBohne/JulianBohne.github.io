@binding(0) @group(0) var tex_0 : texture_2d<f32>;

struct pixelOutput_0
{
    @location(0) output_0 : vec4<f32>,
};

struct pixelInput_0
{
    @location(0) uv_0 : vec2<f32>,
};

@fragment
fn frag( _S1 : pixelInput_0, @builtin(position) position_0 : vec4<f32>) -> pixelOutput_0
{
    var width_0 : u32;
    var height_0 : u32;
    {var dim = textureDimensions((tex_0));((width_0)) = dim.x;((height_0)) = dim.y;};
    var _S2 : vec3<i32> = vec3<i32>(vec3<u32>(u32(_S1.uv_0.x * f32(width_0 - u32(1))), u32(_S1.uv_0.y * f32(height_0 - u32(1))), u32(0)));
    var _S3 : pixelOutput_0 = pixelOutput_0( (textureLoad((tex_0), ((_S2)).xy, ((_S2)).z)) );
    return _S3;
}


struct Gaussian3D_std430_0
{
    @align(16) position_0 : vec3<f32>,
    @align(16) rotation_0 : vec4<f32>,
    @align(16) scale_0 : vec3<f32>,
    @align(16) color_0 : vec3<f32>,
    @align(4) alpha_0 : f32,
};

@binding(1) @group(0) var<storage, read_write> gaussians_3d_0 : array<Gaussian3D_std430_0>;

struct _MatrixStorage_float2x2_ColMajorstd430_0
{
    @align(8) data_0 : array<vec2<f32>, i32(2)>,
};

struct Gaussian2D_std430_0
{
    @align(16) position_1 : vec2<f32>,
    @align(8) depth_0 : f32,
    @align(16) inv_cov_0 : _MatrixStorage_float2x2_ColMajorstd430_0,
    @align(16) color_1 : vec3<f32>,
    @align(4) alpha_1 : f32,
    @align(16) circle_transformation_0 : _MatrixStorage_float2x2_ColMajorstd430_0,
};

@binding(2) @group(0) var<storage, read_write> gaussians_2d_0 : array<Gaussian2D_std430_0>;

struct _MatrixStorage_float4x4_ColMajorstd140_0
{
    @align(16) data_1 : array<vec4<f32>, i32(4)>,
};

struct SplatCamera_std140_0
{
    @align(16) mv_0 : _MatrixStorage_float4x4_ColMajorstd140_0,
    @align(16) projection_0 : _MatrixStorage_float4x4_ColMajorstd140_0,
};

@binding(0) @group(0) var<uniform> camera_0 : SplatCamera_std140_0;
@binding(3) @group(0) var<storage, read_write> gaussian_depths_0 : array<f32>;

@binding(4) @group(0) var<storage, read_write> sorted_indices_0 : array<u32>;

@binding(5) @group(0) var<storage, read_write> sorted_gaussians_2d_0 : array<Gaussian2D_std430_0>;

@binding(6) @group(0) var output_0 : texture_storage_2d<rgba32float, write>;

fn SplatCamera_jacobian_0( this_0 : ptr<function, SplatCamera_std140_0>,  at_0 : vec4<f32>) -> mat3x3<f32>
{
    var _S1 : mat4x4<f32> = mat4x4<f32>((*this_0).projection_0.data_1[i32(0)][i32(0)], (*this_0).projection_0.data_1[i32(1)][i32(0)], (*this_0).projection_0.data_1[i32(2)][i32(0)], (*this_0).projection_0.data_1[i32(3)][i32(0)], (*this_0).projection_0.data_1[i32(0)][i32(1)], (*this_0).projection_0.data_1[i32(1)][i32(1)], (*this_0).projection_0.data_1[i32(2)][i32(1)], (*this_0).projection_0.data_1[i32(3)][i32(1)], (*this_0).projection_0.data_1[i32(0)][i32(2)], (*this_0).projection_0.data_1[i32(1)][i32(2)], (*this_0).projection_0.data_1[i32(2)][i32(2)], (*this_0).projection_0.data_1[i32(3)][i32(2)], (*this_0).projection_0.data_1[i32(0)][i32(3)], (*this_0).projection_0.data_1[i32(1)][i32(3)], (*this_0).projection_0.data_1[i32(2)][i32(3)], (*this_0).projection_0.data_1[i32(3)][i32(3)]);
    var _S2 : f32 = at_0.z;
    var _S3 : f32 = _S2 * _S2;
    return mat3x3<f32>(_S1[i32(0)][i32(0)] / _S2, 0.0f, - (_S1[i32(0)][i32(0)] * at_0.x) / _S3, 0.0f, _S1[i32(1)][i32(1)] / _S2, - (_S1[i32(1)][i32(1)] * at_0.y) / _S3, 0.0f, 0.0f, - _S1[i32(2)][i32(3)] / _S3);
}

fn quat_to_mat_0( quaternion_0 : vec4<f32>) -> mat3x3<f32>
{
    var q_0 : vec4<f32> = normalize(quaternion_0);
    var _S4 : f32 = q_0.y;
    var _S5 : f32 = _S4 * _S4;
    var _S6 : f32 = q_0.z;
    var _S7 : f32 = _S6 * _S6;
    var _S8 : f32 = q_0.x;
    var _S9 : f32 = _S8 * _S4;
    var _S10 : f32 = q_0.w;
    var _S11 : f32 = _S6 * _S10;
    var _S12 : f32 = _S8 * _S6;
    var _S13 : f32 = _S4 * _S10;
    var _S14 : f32 = _S8 * _S8;
    var _S15 : f32 = _S4 * _S6;
    var _S16 : f32 = _S8 * _S10;
    return mat3x3<f32>(1.0f - 2.0f * (_S5 + _S7), 2.0f * (_S9 - _S11), 2.0f * (_S12 + _S13), 2.0f * (_S9 + _S11), 1.0f - 2.0f * (_S14 + _S7), 2.0f * (_S15 - _S16), 2.0f * (_S12 - _S13), 2.0f * (_S15 + _S16), 1.0f - 2.0f * (_S14 + _S5));
}

fn scale_mat_0( scale_1 : vec3<f32>) -> mat3x3<f32>
{
    return mat3x3<f32>(scale_1.x, 0.0f, 0.0f, 0.0f, scale_1.y, 0.0f, 0.0f, 0.0f, scale_1.z);
}

fn inverse_0( mat_0 : mat2x2<f32>) -> mat2x2<f32>
{
    var det_0 : f32 = determinant(mat_0);
    var output_1 : mat2x2<f32>;
    output_1[i32(0)][i32(0)] = mat_0[i32(1)][i32(1)] / det_0;
    output_1[i32(0)][i32(1)] = - mat_0[i32(0)][i32(1)] / det_0;
    output_1[i32(1)][i32(0)] = - mat_0[i32(1)][i32(0)] / det_0;
    output_1[i32(1)][i32(1)] = mat_0[i32(0)][i32(0)] / det_0;
    return output_1;
}

fn eigen_0( mat_1 : mat2x2<f32>) -> mat2x2<f32>
{
    var d_0 : f32 = determinant(mat_1);
    var _S17 : f32 = mat_1[i32(0)][i32(0)] + mat_1[i32(1)][i32(1)];
    var _S18 : f32 = _S17 * _S17;
    var l1_0 : f32 = _S17 / 2.0f + sqrt(_S18 / 4.0f - d_0);
    var l2_0 : f32 = _S17 / 2.0f - sqrt(_S18 / 4.0f - d_0);
    return mat2x2<f32>(normalize(vec2<f32>(l1_0 - mat_1[i32(1)][i32(1)], mat_1[i32(1)][i32(0)])) * vec2<f32>(sqrt(l1_0)), normalize(vec2<f32>(l2_0 - mat_1[i32(1)][i32(1)], mat_1[i32(1)][i32(0)])) * vec2<f32>(sqrt(l2_0)));
}

struct Gaussian2D_0
{
     position_1 : vec2<f32>,
     depth_0 : f32,
     inv_cov_0 : mat2x2<f32>,
     color_1 : vec3<f32>,
     alpha_1 : f32,
     circle_transformation_0 : mat2x2<f32>,
};

fn Gaussian2D_x24init_0( position_2 : vec2<f32>,  depth_1 : f32,  inv_cov_1 : mat2x2<f32>,  color_2 : vec3<f32>,  alpha_2 : f32,  circle_transformation_1 : mat2x2<f32>) -> Gaussian2D_0
{
    var _S19 : Gaussian2D_0;
    _S19.position_1 = position_2;
    _S19.depth_0 = depth_1;
    _S19.inv_cov_0 = inv_cov_1;
    _S19.color_1 = color_2;
    _S19.alpha_1 = alpha_2;
    _S19.circle_transformation_0 = circle_transformation_1;
    return _S19;
}

fn Gaussian3D_transform_0( this_1 : ptr<function, Gaussian3D_std430_0>,  cam_0 : ptr<function, SplatCamera_std140_0>) -> Gaussian2D_0
{
    var _S20 : mat4x4<f32> = mat4x4<f32>((*cam_0).mv_0.data_1[i32(0)][i32(0)], (*cam_0).mv_0.data_1[i32(1)][i32(0)], (*cam_0).mv_0.data_1[i32(2)][i32(0)], (*cam_0).mv_0.data_1[i32(3)][i32(0)], (*cam_0).mv_0.data_1[i32(0)][i32(1)], (*cam_0).mv_0.data_1[i32(1)][i32(1)], (*cam_0).mv_0.data_1[i32(2)][i32(1)], (*cam_0).mv_0.data_1[i32(3)][i32(1)], (*cam_0).mv_0.data_1[i32(0)][i32(2)], (*cam_0).mv_0.data_1[i32(1)][i32(2)], (*cam_0).mv_0.data_1[i32(2)][i32(2)], (*cam_0).mv_0.data_1[i32(3)][i32(2)], (*cam_0).mv_0.data_1[i32(0)][i32(3)], (*cam_0).mv_0.data_1[i32(1)][i32(3)], (*cam_0).mv_0.data_1[i32(2)][i32(3)], (*cam_0).mv_0.data_1[i32(3)][i32(3)]);
    var cam_space_position_0 : vec4<f32> = (((vec4<f32>((*this_1).position_0, 1.0f)) * (_S20)));
    var projected_position_0 : vec4<f32> = (((cam_space_position_0) * (mat4x4<f32>((*cam_0).projection_0.data_1[i32(0)][i32(0)], (*cam_0).projection_0.data_1[i32(1)][i32(0)], (*cam_0).projection_0.data_1[i32(2)][i32(0)], (*cam_0).projection_0.data_1[i32(3)][i32(0)], (*cam_0).projection_0.data_1[i32(0)][i32(1)], (*cam_0).projection_0.data_1[i32(1)][i32(1)], (*cam_0).projection_0.data_1[i32(2)][i32(1)], (*cam_0).projection_0.data_1[i32(3)][i32(1)], (*cam_0).projection_0.data_1[i32(0)][i32(2)], (*cam_0).projection_0.data_1[i32(1)][i32(2)], (*cam_0).projection_0.data_1[i32(2)][i32(2)], (*cam_0).projection_0.data_1[i32(3)][i32(2)], (*cam_0).projection_0.data_1[i32(0)][i32(3)], (*cam_0).projection_0.data_1[i32(1)][i32(3)], (*cam_0).projection_0.data_1[i32(2)][i32(3)], (*cam_0).projection_0.data_1[i32(3)][i32(3)]))));
    var ndc_position_0 : vec4<f32> = projected_position_0 / vec4<f32>(projected_position_0.w);
    var _S21 : mat3x3<f32> = SplatCamera_jacobian_0(&((*cam_0)), cam_space_position_0);
    var transformed_half_cov_0 : mat3x3<f32> = (((((((((scale_mat_0((*this_1).scale_0)) * (quat_to_mat_0((*this_1).rotation_0))))) * (mat3x3<f32>(_S20[i32(0)].xyz, _S20[i32(1)].xyz, _S20[i32(2)].xyz))))) * (_S21)));
    var cov_0 : mat3x3<f32> = (((transpose(transformed_half_cov_0)) * (transformed_half_cov_0)));
    var _S22 : mat2x2<f32> = mat2x2<f32>(cov_0[i32(0)].xy, cov_0[i32(1)].xy);
    var half_cov_t_0 : mat2x2<f32> = eigen_0(_S22);
    var _S23 : vec2<f32> = vec2<f32>(2.0f);
    var axis_a_0 : vec2<f32> = half_cov_t_0[i32(0)] * _S23;
    var axis_b_0 : vec2<f32> = half_cov_t_0[i32(1)] * _S23;
    return Gaussian2D_x24init_0(ndc_position_0.xy, ndc_position_0.z, inverse_0(_S22), (*this_1).color_0, (*this_1).alpha_0, mat2x2<f32>(axis_a_0 / vec2<f32>(dot(axis_a_0, axis_a_0)), axis_b_0 / vec2<f32>(dot(axis_b_0, axis_b_0))));
}

fn Gaussian2D_intersects_quad_0( this_2 : ptr<function, Gaussian2D_std430_0>,  quad_points_0 : array<vec2<f32>, i32(4)>) -> bool
{
    var transformed_quad_points_0 : array<vec2<f32>, i32(4)>;
    const _S24 : vec2<f32> = vec2<f32>(0.0f, 0.0f);
    var i_0 : i32 = i32(0);
    var center_0 : vec2<f32> = _S24;
    for(;;)
    {
        if(i_0 < i32(4))
        {
        }
        else
        {
            break;
        }
        var _S25 : vec2<f32> = (((quad_points_0[i_0] - (*this_2).position_1) * (mat2x2<f32>((*this_2).circle_transformation_0.data_0[i32(0)][i32(0)], (*this_2).circle_transformation_0.data_0[i32(1)][i32(0)], (*this_2).circle_transformation_0.data_0[i32(0)][i32(1)], (*this_2).circle_transformation_0.data_0[i32(1)][i32(1)]))));
        transformed_quad_points_0[i_0] = _S25;
        var center_1 : vec2<f32> = center_0 + _S25;
        i_0 = i_0 + i32(1);
        center_0 = center_1;
    }
    var center_2 : vec2<f32> = center_0 / vec2<f32>(4.0f);
    var testPoint_0 : vec2<f32> = center_2 / vec2<f32>(length(center_2));
    var normals_0 : array<vec2<f32>, i32(4)>;
    var _S26 : vec2<f32> = transformed_quad_points_0[i32(1)] - transformed_quad_points_0[i32(0)];
    var _S27 : vec2<f32> = normalize(vec2<f32>(- _S26.y, _S26.x));
    normals_0[i32(0)] = _S27;
    var _S28 : vec2<f32> = transformed_quad_points_0[i32(2)] - transformed_quad_points_0[i32(1)];
    normals_0[i32(1)] = normalize(vec2<f32>(- _S28.y, _S28.x));
    var _S29 : vec2<f32> = transformed_quad_points_0[i32(3)] - transformed_quad_points_0[i32(2)];
    normals_0[i32(2)] = normalize(vec2<f32>(- _S29.y, _S29.x));
    var _S30 : vec2<f32> = transformed_quad_points_0[i32(0)] - transformed_quad_points_0[i32(3)];
    normals_0[i32(3)] = normalize(vec2<f32>(- _S30.y, _S30.x));
    var intersects_0 : bool;
    if((dot(testPoint_0 - transformed_quad_points_0[i32(0)], _S27)) < 1.0f)
    {
        intersects_0 = (dot(testPoint_0 - transformed_quad_points_0[i32(1)], normals_0[i32(1)])) < 1.0f;
    }
    else
    {
        intersects_0 = false;
    }
    if(intersects_0)
    {
        intersects_0 = (dot(testPoint_0 - transformed_quad_points_0[i32(2)], normals_0[i32(2)])) < 1.0f;
    }
    else
    {
        intersects_0 = false;
    }
    if(intersects_0)
    {
        intersects_0 = (dot(testPoint_0 - transformed_quad_points_0[i32(3)], normals_0[i32(3)])) < 1.0f;
    }
    else
    {
        intersects_0 = false;
    }
    var intersects_flipped_0 : bool;
    if((dot(testPoint_0 - transformed_quad_points_0[i32(0)], (vec2<f32>(0) - normals_0[i32(0)]))) < 1.0f)
    {
        intersects_flipped_0 = (dot(testPoint_0 - transformed_quad_points_0[i32(1)], (vec2<f32>(0) - normals_0[i32(1)]))) < 1.0f;
    }
    else
    {
        intersects_flipped_0 = false;
    }
    if(intersects_flipped_0)
    {
        intersects_flipped_0 = (dot(testPoint_0 - transformed_quad_points_0[i32(2)], (vec2<f32>(0) - normals_0[i32(2)]))) < 1.0f;
    }
    else
    {
        intersects_flipped_0 = false;
    }
    if(intersects_flipped_0)
    {
        intersects_flipped_0 = (dot(testPoint_0 - transformed_quad_points_0[i32(3)], (vec2<f32>(0) - normals_0[i32(3)]))) < 1.0f;
    }
    else
    {
        intersects_flipped_0 = false;
    }
    if(intersects_0)
    {
        intersects_0 = true;
    }
    else
    {
        intersects_0 = intersects_flipped_0;
    }
    return intersects_0;
}

@compute
@workgroup_size(256, 1, 1)
fn transform_gaussians(@builtin(global_invocation_id) threadId_0 : vec3<u32>)
{
    var global_thread_id_0 : u32 = threadId_0.x;
    var _S31 : vec2<u32> = vec2<u32>(arrayLength(&gaussians_3d_0), 64);
    var full_ndc_0 : array<vec2<f32>, i32(4)> = array<vec2<f32>, i32(4)>( vec2<f32>(-1.0f, -1.0f), vec2<f32>(-1.0f, 1.0f), vec2<f32>(1.0f, 1.0f), vec2<f32>(1.0f, -1.0f) );
    if(global_thread_id_0 < (_S31.x))
    {
        var _S32 : Gaussian3D_std430_0 = gaussians_3d_0[global_thread_id_0];
        var _S33 : SplatCamera_std140_0 = camera_0;
        var _S34 : Gaussian2D_0 = Gaussian3D_transform_0(&(_S32), &(_S33));
        gaussians_2d_0[global_thread_id_0].position_1 = _S34.position_1;
        gaussians_2d_0[global_thread_id_0].depth_0 = _S34.depth_0;
        var _S35 : array<vec2<f32>, i32(2)> = array<vec2<f32>, i32(2)>( vec2<f32>(_S34.inv_cov_0[i32(0)][i32(0)], _S34.inv_cov_0[i32(1)][i32(0)]), vec2<f32>(_S34.inv_cov_0[i32(0)][i32(1)], _S34.inv_cov_0[i32(1)][i32(1)]) );
        gaussians_2d_0[global_thread_id_0].inv_cov_0.data_0 = _S35;
        gaussians_2d_0[global_thread_id_0].color_1 = _S34.color_1;
        gaussians_2d_0[global_thread_id_0].alpha_1 = _S34.alpha_1;
        var _S36 : array<vec2<f32>, i32(2)> = array<vec2<f32>, i32(2)>( vec2<f32>(_S34.circle_transformation_0[i32(0)][i32(0)], _S34.circle_transformation_0[i32(1)][i32(0)]), vec2<f32>(_S34.circle_transformation_0[i32(0)][i32(1)], _S34.circle_transformation_0[i32(1)][i32(1)]) );
        gaussians_2d_0[global_thread_id_0].circle_transformation_0.data_0 = _S36;
        var _S37 : f32 = gaussians_2d_0[global_thread_id_0].depth_0;
        var _S38 : Gaussian2D_std430_0 = gaussians_2d_0[global_thread_id_0];
        var _S39 : bool = Gaussian2D_intersects_quad_0(&(_S38), full_ndc_0);
        var _S40 : f32;
        if(_S39)
        {
            _S40 = 0.0f;
        }
        else
        {
            _S40 = 1000.0f;
        }
        gaussian_depths_0[global_thread_id_0] = _S37 + _S40;
        sorted_indices_0[global_thread_id_0] = global_thread_id_0;
    }
    return;
}

@compute
@workgroup_size(256, 1, 1)
fn apply_sorted_indices(@builtin(global_invocation_id) threadId_1 : vec3<u32>)
{
    var _S41 : vec2<u32> = vec2<u32>(arrayLength(&gaussians_2d_0), 64);
    var _S42 : u32 = threadId_1.x;
    if(_S42 < (_S41.x))
    {
        sorted_gaussians_2d_0[_S42] = gaussians_2d_0[sorted_indices_0[_S42]];
    }
    return;
}

fn gaussianPDF_0( coord_0 : vec2<f32>,  mew_0 : vec2<f32>,  invCov_0 : mat2x2<f32>) -> f32
{
    var _S43 : vec2<f32> = coord_0 - mew_0;
    return exp(-0.5f * dot(_S43, (((_S43) * (invCov_0)))));
}

@compute
@workgroup_size(16, 16, 1)
fn render(@builtin(global_invocation_id) threadId_2 : vec3<u32>, @builtin(local_invocation_id) groupThreadId_0 : vec3<u32>, @builtin(workgroup_id) groupId_0 : vec3<u32>)
{
    var output_width_0 : u32;
    var output_height_0 : u32;
    {var dim = textureDimensions((output_0));((output_width_0)) = dim.x;((output_height_0)) = dim.y;};
    var _S44 : vec2<u32> = vec2<u32>(arrayLength(&gaussians_2d_0), 64);
    var _S45 : u32 = _S44.x;
    var _S46 : vec2<u32> = threadId_2.xy;
    if(!(all((_S46 < vec2<u32>(output_width_0, output_height_0)))))
    {
        return;
    }
    var _S47 : vec2<f32> = (vec2<f32>(2.0f) * (vec2<f32>(_S46) / vec2<f32>(f32(output_width_0), f32(output_height_0))) - vec2<f32>(1.0f)) * vec2<f32>(1.0f, -1.0f);
    var color_3 : vec3<f32> = vec3<f32>(vec3<i32>(i32(0)));
    var opacity_0 : f32 = 0.0f;
    var i_1 : u32 = u32(0);
    for(;;)
    {
        if(i_1 < _S45)
        {
        }
        else
        {
            break;
        }
        var _S48 : bool;
        if((gaussians_2d_0[i_1].depth_0) < 0.0f)
        {
            _S48 = true;
        }
        else
        {
            _S48 = (gaussians_2d_0[i_1].depth_0) > 1.0f;
        }
        if(_S48)
        {
            i_1 = i_1 + u32(1);
            continue;
        }
        var current_alpha_0 : f32 = gaussians_2d_0[i_1].alpha_1 * gaussianPDF_0(_S47, gaussians_2d_0[i_1].position_1, mat2x2<f32>(gaussians_2d_0[i_1].inv_cov_0.data_0[i32(0)][i32(0)], gaussians_2d_0[i_1].inv_cov_0.data_0[i32(1)][i32(0)], gaussians_2d_0[i_1].inv_cov_0.data_0[i32(0)][i32(1)], gaussians_2d_0[i_1].inv_cov_0.data_0[i32(1)][i32(1)]));
        var _S49 : f32 = 1.0f - opacity_0;
        var _S50 : vec3<f32> = color_3 + vec3<f32>(_S49) * gaussians_2d_0[i_1].color_1 * vec3<f32>(current_alpha_0);
        var opacity_1 : f32 = opacity_0 + _S49 * current_alpha_0;
        if(opacity_1 > 0.99000000953674316f)
        {
            color_3 = _S50;
            break;
        }
        color_3 = _S50;
        opacity_0 = opacity_1;
        i_1 = i_1 + u32(1);
    }
    textureStore((output_0), (_S46), (vec4<f32>(color_3, 1.0f)));
    return;
}


// A basic demo of using textures and loading images (solution)
'use strict';

import WaterFrameBuffer from "./WaterFrameBuffer.js";

// Allow use of glMatrix values directly instead of needing the glMatrix prefix
const vec3 = glMatrix.vec3;
const vec4 = glMatrix.vec4;
const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;

// Global WebGL context variable
let gl;

// Matrices used during rendering
const modelViewMatrix = mat4.create();
const rotationMatrix = mat4.create();

// Key values that are used for movement
let movementKeyList = ["ArrowUp", "ArrowDown", "w", "s"];

// Position values
let movementZ = 0.0; // Varies based on whether or not the camera is moving forward or backwards

// View values
let position = [-5, -1, -12, 0];
let rotation = [0, 0, 0];
let scale = [1, 1, 1];

// Objects to be drawn
let obj;
let waterFBO;

let gl_vertex = [];
let gl_texture = [];
let gl_index = [];

let time = new Date().getTime();


// Once the document is fully loaded run this init function.
window.addEventListener('load', function init() {
    // Get the HTML5 canvas object from it's ID
    const canvas = document.getElementById('webgl-canvas');
    if (!canvas) { window.alert('Could not find #webgl-canvas'); return; }

    // Get the WebGL context (save into a global variable)
    gl = canvas.getContext('webgl2');
    if (!gl) { window.alert("WebGL isn't available"); return; }

    // Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height); // this is the region of the canvas we want to draw on (all of it)
    gl.clearColor(0, 0, 0, 0); // setup the background color with red, green, blue, and alpha
    // gl.enable(gl.DEPTH_TEST);
    // gl.enable(gl.CULL_FACE);
    // gl.cullFace(gl.BACK);

    // Initialize the WebGL program and data
    gl.program = initProgram();
    initBuffers();
    initTextures();
    initEvents();

    // Set initial values of uniforms
    updateMovement();
    // updateRotationMatrix();
    updateModelViewMatrix();

    // Render the static scene
    onWindowResize();

    // initTextures();
    // render();
});


/**
 * Initializes the WebGL program.
 */
function initProgram() {
    // Compile shaders
    // Vertex Shader
    let vert_shader = compileShader(gl, gl.VERTEX_SHADER,
        `#version 300 es
        precision mediump float;

        // Matrices
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        uniform mat4 uRotationMatrix;

        // Light Position
        const vec4 light = vec4(0, 0, 5, 1);

        // Attributes for the vertex (from VBOs)
        in vec4 aPosition;
        in vec3 aNormal;
        in vec2 aTexCoord;
        in vec2 aDudvCoord;

        // Vectors (varying variables to vertex shader)
        out vec3 vNormalVector;
        out vec3 vLightVector;
        out vec3 vEyeVector;

        // Texture information
        out vec2 vTexCoord;
        out vec2 vDudvCoord;

        void main() {
            vec4 P = uModelViewMatrix * aPosition;

            vNormalVector = mat3(uModelViewMatrix) * aNormal;
            vLightVector = light.w == 1.0 ? P.xyz - light.xyz : light.xyz;
            vEyeVector = -P.xyz;

            gl_Position = uProjectionMatrix * P;

            vTexCoord = aTexCoord;
            vDudvCoord = aDudvCoord;
        }`
    );
    // Fragment Shader - Phong Shading and Reflections
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        in vec2 vTexCoord;

        out vec4 fragColor;

        uniform sampler2D reflectionTexture;
        uniform sampler2D refractionTexture;

        void main() {
            vec4 reflectionColor = texture(reflectionTexture, vTexCoord);
            vec4 refractionColor = texture(refractionTexture, vTexCoord);
            fragColor = mix(reflectionColor, refractionColor, 0.5);
        }`
        // uniform float uTime;

        // // Light and material properties
        // const vec3 lightColor = vec3(1, 1, 1);
        // const vec4 materialColor = vec4(0, 1, 0, 1);
        // const float materialAmbient = 0.2;
        // const float materialDiffuse = 0.5;
        // const float materialSpecular = 0.3;
        // const float materialShininess = 10.0;
        // const float materialReflection = 0.5;

        // // Vectors (varying variables from vertex shader)
        // in vec3 vNormalVector;
        // in vec3 vLightVector;
        // in vec3 vEyeVector;

        // // TODO: Texture information
        // uniform sampler2D uTexture, uTexDudv;
        // in vec2 vTexCoord;
        // in vec2 vDudvCoord;

        // uniform samplerCube uEnvMap;

        // // Output color
        // out vec4 fragColor;

        // void main() {
        //     // Normalize vectors
        //     vec3 N = normalize(vNormalVector);
        //     vec3 L = normalize(vLightVector);
        //     vec3 E = normalize(vEyeVector);

        //     // Compute lighting
        //     float diffuse = dot(-L, N);
        //     float specular = 0.0;
        //     if (diffuse < 0.0) {
        //         diffuse = 0.0;
        //     } else {
        //         vec3 R = reflect(L, N);
        //         specular = pow(max(dot(R, E), 0.0), materialShininess);
        //         // vec3 R = reflect(E, N); // Compute reflection vector
        //         // vec4 envColor = texture(uEnvMap, R); // Sample environment texture with reflection vector
        //         // specular = pow(max(dot(R, L), 0.0), materialShininess);
        //         // fragColor.rgb = materialColor.rgb * (materialAmbient + materialDiffuse * diffuse + materialSpecular * specular) + materialReflection * envColor.rgb; // Combine reflection color with material color
        //         // fragColor.a = materialColor.a;
        //     }

        //     vec2 distortion = texture(uTexDudv, vec2(vTexCoord.x, vTexCoord.y)).rg * 2.0 - 1.0;

        //     // TODO: Object color combined from texture and material
		// 	vec4 color = texture(uTexture, vTexCoord);
            


        //     // Compute final color
        //     fragColor.rgb = lightColor * (
        //         (materialAmbient + materialDiffuse * diffuse) * color.rgb +
        //         materialSpecular * specular);
        //     fragColor.a = .8;
        // }`
    );

    // Link the shaders into a program and use them with the WebGL context
    let program = linkProgram(gl, vert_shader, frag_shader);
    gl.useProgram(program);
    
    // Get the attribute indices
    program.aPosition = gl.getAttribLocation(program, 'aPosition');
    program.aNormal = gl.getAttribLocation(program, 'aNormal');
    program.aTexCoord = gl.getAttribLocation(program, 'aTexCoord');

    // Get the uniform indices
    program.uModelViewMatrix = gl.getUniformLocation(program, 'uModelViewMatrix');
    program.uProjectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');
    program.uRotationMatrix = gl.getUniformLocation(program, 'uRotationMatrix');
    program.uTexture = gl.getUniformLocation(program, 'uTexture');
    program.uTexDudv = gl.getUniformLocation(program, 'uTexDudv');
    program.reflectionTexture = gl.getUniformLocation(program, 'reflectionTexture');
    program.refractionTexture = gl.getUniformLocation(program, 'refractionTexture');
    program.uTime = gl.getUniformLocation(program, 'uTime');

    return program;
}


/**
 * Initialize the data buffers.
 */
function initBuffers() {
    // The vertices, colors, and indices for a cube
    generateGrid(10)

    waterFBO = new WaterFrameBuffer(gl);
    obj = createObject(gl_vertex, gl_texture, gl_index, false);
}


/**
 * Creates a VAO containing the coordinates, colors, and indices provided
 */
function createObject(coords, tex_coords, indices, is_tri_strip) {
    coords = Float32Array.from(coords);
    tex_coords = Float32Array.from(tex_coords);
    let normals = coords;

    // Create and bind VAO
    let vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Load the coordinate data into the GPU and associate with shader
    let buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, coords, gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl.program.aPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.program.aPosition);

    // Load the normal data into the GPU and associate with shader
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl.program.aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.program.aNormal);
    
    // Load the texture coordinate data into the GPU and associate with shader
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, tex_coords, gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl.program.aTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(gl.program.aTexCoord);

    // Load the index data into the GPU
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Uint16Array.from(indices), gl.STATIC_DRAW);

    // Cleanup
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // Return the object information
    return [vao, indices.length, is_tri_strip ? gl.TRIANGLE_STRIP : gl.TRIANGLES];
}


/**
 * Load a texture onto the GPU.
 */
function loadTexture(img) {
    // TODO
    let texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, null)

    return texture;
}


/**
 * Initialize the texture buffers.
 */
function initTextures() {
    let image = new Image();
    image.src = 'waternormal.jpg';
    let dudv = new Image();
    dudv.src = 'waterdudvmap.jpg';
    image.addEventListener('load', () => {
        obj.push(loadTexture(image));
        // obj.push(loadTexture(dudv));
        console.log(image)

        render();
    });
}


/**
 * Initialize event handlers
 */
function initEvents() {
    window.addEventListener('resize', onWindowResize);
    // gl.canvas.addEventListener('mousedown', onMouseDown);
    gl.canvas.addEventListener('wheel', onMouseWheel);
    window.addEventListener('keydown', buttonHandler); 
}


/**
 * Update the model view matrix.
 */
function updateModelViewMatrix() {
    // let mv = mat4.fromRotationTranslationScale(mat4.create(),
    //     quat.fromEuler(glMatrix.quat.create(), ...rotation), position, scale);
    vec4.transformMat4(position, position, modelViewMatrix);
    gl.uniformMatrix4fv(gl.program.uModelViewMatrix, false, modelViewMatrix);
}

function generateGrid(gridSize) {

    let i = 0;
    for(let x=0.0; x<gridSize; x+=1.0) {
        for (let z = 0.0; z <gridSize; z += 1.0) {
            gl_vertex.push(x, 0.0, z);        //left upper
            gl_vertex.push(x+1.0, 0.0, z);
            gl_vertex.push(x+1.0, 0.0, z+1.0);
            gl_vertex.push(x, 0.0, z+1.0);

            gl_texture.push( 0.0, 0.0);
            gl_texture.push( 1.0, 0.0);
            gl_texture.push( 1.0, 1.0);
            gl_texture.push( 0.0, 1.0);

            gl_index.push(i);
            gl_index.push(i+1);
            gl_index.push(i+2);
            gl_index.push(i);
            gl_index.push(i+2);
            gl_index.push(i+3);
            i +=4;
        }
    }
}

/**
 * Handle the click-and-drag to rotate the cube.
 */
function onMouseDown(e) {
    e.preventDefault();

    let [startX, startY] = [e.offsetX, e.offsetY];
    let start_rotation = rotation.slice();
    function onMouseMove(e2) {
        let x_rotation = (e2.offsetX - startX) / (this.width - 1) * 360;
        let y_rotation = (e2.offsetY - startY) / (this.height - 1) * 360;
        rotation[0] = start_rotation[0] + y_rotation;
        rotation[1] = start_rotation[1] + x_rotation;
        updateModelViewMatrix();
    }
    function onMouseUp() {
        this.removeEventListener('mousemove', onMouseMove);
        this.removeEventListener('mouseup', onMouseUp);
    }
    if (e.button === 0) {
        this.addEventListener('mousemove', onMouseMove);
        this.addEventListener('mouseup', onMouseUp);
    }
}


/**
 * "Zoom" when using the mouse wheel.
 */
function onMouseWheel(e) {
    e.preventDefault();
    let s = scale[0] * Math.pow(1.005, e.deltaY);
    scale = [s, s, s];
    updateModelViewMatrix();
}


/**
 * Update the projection matrix.
 */
function updateProjectionMatrix() {
    let aspect = gl.canvas.width / gl.canvas.height;
    let p = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, 1000);
    gl.uniformMatrix4fv(gl.program.uProjectionMatrix, false, p);
}

/**
 * Updates the rotation matrix. Called whenever a button is pressed that will modify the position or angle of the camera.
 */
function updateRotationMatrix() {
    gl.uniformMatrix4fv(gl.program.uRotationMatrix, false, rotationMatrix);
}

/**
 * Converts degrees to radians.
 */
function deg2rad(degrees) {
    return degrees * Math.PI / 180;
}

/**
 * Update movement each time arrow up or arrow down is pressed.
 */
function updateMovement() {
    vec4.transformMat4(position, [position[0], position[1], position[2] + movementZ, position[3]], modelViewMatrix);
    mat4.translate(modelViewMatrix, rotationMatrix, position);
}

/**
 * Updates the pitch of the camera for each press of 'w' or 's'.
 */
function updatePitch() {
    rotation = deg2rad(90);
    mat4.rotateX(rotationMatrix, rotationMatrix, rotation);
}

/**
 * Handles movement buttons
 */
function buttonHandler(event) {
    if (movementKeyList.includes(event.key)) {
        event.preventDefault();
        if (event.key === "ArrowUp") {
            movementZ = 0.05;
        } else if (event.key === "ArrowDown") { 
            movementZ = -0.05;
        } else if (event.key === "w") {
            //pitch = deg2rad(1);
            updatePitch();
        } else if (event.key === "s") {
            //pitch = -deg2rad(1);
            updatePitch();
        }
    }
    updateMovement();
    updateRotationMatrix();
    updateModelViewMatrix();
}


/**
 * Keep the canvas sized to the window.
 */
function onWindowResize() {
    gl.canvas.width = window.innerWidth;
    gl.canvas.height = window.innerHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    updateProjectionMatrix();
}


/**
 * Render the scene. Must be called once and only once. It will call itself again.
 */
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    time = new Date().getTime();
    // gl.uniform1f(gl.program.uTime, time);
    waterFBO.bindReflectionFrameBuffer();
    // window.requestAnimationFrame(render);


    let [vao, count, mode, texture, dudv] = obj;
    gl.bindVertexArray(vao);
    // gl.activeTexture(gl.TEXTURE0);
    // gl.bindTexture(gl.TEXTURE_2D, texture);
    // gl.activeTexture(gl.TEXTURE1);
    // gl.bindTexture(gl.TEXTURE_2D, dudv);
    waterFBO.unbindCurrentFrameBuffer();
    gl.drawElements(mode, count, gl.UNSIGNED_SHORT, 0);
    // Cleanup
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    

    console.log(gl.program.aTexCoord)
    

    // Render again
    window.requestAnimationFrame(render);
}



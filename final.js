// A basic demo of using textures (solution)
'use strict';

// Allow use of glMatrix values directly instead of needing the glMatrix prefix
const vec3 = glMatrix.vec3;
const vec4 = glMatrix.vec4;
const mat3 = glMatrix.mat3;
const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;

// Global WebGL context variable
let canvas;
let gl;
let camera;
let skybox;
let grid;

let deltaTime = 0;
let lastFrame = 0;

// View values
let lastPosition = [0, 0]; // instead of lastX, lastY
let rotation = [0, 0, 0];
let scale = [1, 1, 1];

const SPEED = 0.005

// Objects to be drawn
let obj;


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
    gl.enable(gl.DEPTH_TEST);

    lastPosition = [canvas.width / 2, canvas.height / 2];

    // Initialize the WebGL program and data
    gl.program = initProgram();
    initBuffers();
    initEvents();
    initTextures();
    initMatrix();


    // Set initial values of uniforms

    gl.uniform3fv(this.shader.lightAmbiant,[0.2, 0.2, 0.2]);
    gl.uniform3fv(this.shader.lightDiffuse,[0.5, 0.5, 0.5]);
    gl.uniform3fv(this.shader.lightSpecular,[1.0, 1.0, 1.0]);
    gl.uniform3fv(this.shader.lightPosition, [20.0, 20.0, 20.0]);
    gl.uniform3fv(this.shader.viewPos, camera.Position);

    gl.uniformMatrix4fv(this.shader.matrixModel, false, this.model);
    gl.uniformMatrix4fv(this.shader.matrixView, false, view);
    gl.uniformMatrix4fv(this.shader.matrixProj, false, projection);
    gl.uniformMatrix3fv(this.shader.matrixNormal, false, this.normal);

    gl.uniform1f(this.shader.detalX, this.i);
    gl.uniform1f(this.shader.time, this.time*0.001);
    
    updateModelViewMatrix();


    // Render the static scene
    onWindowResize();
    render();
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

        // Light Position
        const vec4 light = vec4(0, 0, 5, 1);

        // Attributes for the vertex (from VBOs)
        in vec4 aPosition;
        in vec3 aNormal;
        in vec2 aTexCoord; // TODO: any other attributes?

        // Vectors (varying variables to vertex shader)
        out vec3 vNormalVector;
        out vec3 vLightVector;
        out vec3 vEyeVector;

        // TODO: Texture information
		out vec2 vTexCoord;

        void main() {
            vec4 P = uModelViewMatrix * aPosition;

            vNormalVector = mat3(uModelViewMatrix) * aNormal;
            vLightVector = light.w == 1.0 ? P.xyz - light.xyz : light.xyz;
            vEyeVector = -P.xyz;

            gl_Position = uProjectionMatrix * P;

            vTexCoord = aTexCoord;
        }`
    );
    // Fragment Shader - Phong Shading and Reflections
    let frag_shader = compileShader(gl, gl.FRAGMENT_SHADER,
        `#version 300 es
        precision mediump float;

        // Light and material properties
        const vec3 lightColor = vec3(1, 1, 1);
        const vec4 materialColor = vec4(0, 1, 1, 1);
        const float materialAmbient = 0.2;
        const float materialDiffuse = 0.5;
        const float materialSpecular = 0.3;
        const float materialShininess = 10.0;

        // Vectors (varying variables from vertex shader)
        in vec3 vNormalVector;
        in vec3 vLightVector;
        in vec3 vEyeVector;

        // TODO: Texture information
		uniform sampler2D uTexture;
		in vec2 vTexCoord;

        // Output color
        out vec4 fragColor;

        void main() {
            // Normalize vectors
            vec3 N = normalize(vNormalVector);
            vec3 L = normalize(vLightVector);
            vec3 E = normalize(vEyeVector);

            // Compute lighting
            float diffuse = dot(-L, N);
            float specular = 0.0;
            if (diffuse < 0.0) {
                diffuse = 0.0;
            } else {
                vec3 R = reflect(L, N);
                specular = pow(max(dot(R, E), 0.0), materialShininess);
            }
            
            // TODO: Object color combined from texture and material
			vec4 color = texture(uTexture, vTexCoord) * materialColor;

            // Compute final color
            fragColor.rgb = lightColor * (
                (materialAmbient + materialDiffuse * diffuse) * color.rgb +
                materialSpecular * specular);
            fragColor.a = 1.0;
        }`
    );

    // Link the shaders into a program and use them with the WebGL context
    let program = linkProgram(gl, vert_shader, frag_shader);
    gl.useProgram(program);
    
    // Get the attribute indices
    program.aPosition = gl.getAttribLocation(program, 'aPosition');
    //program.aNormal = gl.getAttribLocation(program, "aNormal"); commented out in original program
    program.aTexCoord = gl.getAttribLocation(program, 'aTexCoord'); // TODO: any other attributes?

    // Get the uniform indices
    program.uModelViewMatrix = gl.getUniformLocation(program, 'uModelViewMatrix');
    program.uProjectionMatrix = gl.getUniformLocation(program, 'uProjectionMatrix');
    program.uTexture = gl.getUniformLocation(program, 'uTexture'); // TODO: any other uniforms?

    // Uniforms from grid.js
    program.matrixModel = gl.getUniformLocation(program, "model");
    program.matrixView = gl.getUniformLocation(program, "view");
    program.matrixProj = gl.getUniformLocation(program, "projection");
    program.matrixNormal = gl.getUniformLocation(program, "normal");

    program.lightAmbiant = gl.getUniformLocation(program, "light.ambient");
    program.lightDiffuse = gl.getUniformLocation(program, "light.diffuse");
    program.lightSpecular = gl.getUniformLocation(program, "light.specular");
    program.lightPosition = gl.getUniformLocation(program, "light.position");
    program.viewPos = gl.getUniformLocation(program, "viewPos");
    program.normalTexture = gl.getUniformLocation(program, "normalSampler");
    program.skyboxloc = gl.getUniformLocation(program , "skybox");
    program.detalX = gl.getUniformLocation(program, "detalX");
    program.time = gl.getUniformLocation(program, "time");

    return program;
}


/**
 * Initialize the data buffers.
 */
function initBuffers() {
    // The vertices, colors, and indices for a cube
    let cube_coords = [
        1, 1, 1,    // A
        -1, 1, 1,   // B
        -1, -1, 1,  // C
        1, -1, 1,   // D
        1, -1, -1,  // E
        -1, -1, -1, // F
        -1, 1, -1,  // G
        1, 1, -1,   // H
    ];
    let cube_tex_coords = [
        0, 0, // A
        1, 0, // B
        1, 1, // C
        0, 1, // D
        0, 0, // E
        1, 0, // F
        1, 1, // G
        0, 1, // H
    ];
    let cube_indices = [
        1, 2, 0, 2, 3, 0,
        7, 6, 1, 0, 7, 1,
        1, 6, 2, 6, 5, 2,
        3, 2, 4, 2, 5, 4,
        6, 7, 5, 7, 4, 5,
        0, 3, 7, 3, 4, 7,
    ];
    obj = createObject(cube_coords, cube_tex_coords, cube_indices, false);

    generateGrid(500)
    
    let vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertex), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    let texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.texture), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    let indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.index), gl.STATIC_DRAW);
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
    
    // TODO: Load the texture coordinate data into the GPU and associate with shader
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
 * Load a texture onto the GPU. The image must be power-of-two sized image using RGBA with uint8
 * values. The image will be flipped vertically and will support mipmapping.
 */
function loadTexture(img, idx) {
    // TODO
    // If second argument not provided, default to 0
    if (typeof idx === "undefined") { idx = 0; }

    let texture = gl.createTexture(); // create a texture resource on the GPU
    gl.activeTexture(gl['TEXTURE'+idx]); // set the current texture that all following commands will apply to
    gl.bindTexture(gl.TEXTURE_2D, texture); // assign our texture resource as the current texture
    //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // tell WebGL to flip the image vertically (almost always want this to be true)

    // Load the image data into the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

    // Setup options for downsampling and upsampling the image data
    //gl.generateMipmap(gl.TEXTURE_2D);
    //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Cleanup and return
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}


/**
 * Initialize the texture buffers.
 */
function initTextures() {
    // let img = createCheckerboardImage(128, 4);
    // obj.push(loadTexture(img));

    gl.normalTex = gl.createTexture();
    gl.normalTex.image = new Image();
    gl.normalTex.image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, gl.normalTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, gl.normalTex.image);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); //Prevents s-coordinate wrapping (repeating).
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); //Prevents t-coordinate wrapping (repeating).
        gl.bindTexture(gl.TEXTURE_2D, null);
    }.bind(); // "used to take this? replacement"
    gl.normalTex.image.src = gl.normalTexPath;

}


/**
 * Initialize event handlers
 */
function initEvents() {
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
}

function initMatrix() {
    mat4.translate(this.model, this.model, [-1000.0, 0.0, -1000.0]);
    mat4.scale(this.model,this.model,[5.0,0.0,5.0]);
    mat3.normalFromMat4(this.normal, this.model);
}


/**
 * Update the model view matrix.
 */
function updateModelViewMatrix() {
    let mv = glMatrix.mat4.fromRotationTranslationScale(glMatrix.mat4.create(),
        glMatrix.quat.fromEuler(glMatrix.quat.create(), ...rotation), position, scale);
    gl.uniformMatrix4fv(gl.program.uModelViewMatrix, false, mv);
}


// /**
//  * Handle the click-and-drag to rotate the cube.
//  */
// function onMouseDown(e) {
//     e.preventDefault();

//     let [startX, startY] = [e.offsetX, e.offsetY];
//     let start_rotation = rotation.slice();
//     function onMouseMove(e2) {
//         let x_rotation = (e2.offsetX - startX) / (this.width - 1) * 360;
//         let y_rotation = (e2.offsetY - startY) / (this.height - 1) * 360;
//         rotation[0] = start_rotation[0] + y_rotation;
//         rotation[1] = start_rotation[1] + x_rotation;
//         updateModelViewMatrix();
//     }
//     function onMouseUp() {
//         this.removeEventListener('mousemove', onMouseMove);
//         this.removeEventListener('mouseup', onMouseUp);
//     }
//     if (e.button === 0) {
//         this.addEventListener('mousemove', onMouseMove);
//         this.addEventListener('mouseup', onMouseUp);
//     }
// }


// /**
//  * "Zoom" when using the mouse wheel.
//  */
// function onMouseWheel(e) {
//     let s = scale[0] * Math.pow(1.05, e.deltaY);
//     scale = [s, s, s];
//     updateModelViewMatrix();
// }


/**
 * Update the projection matrix.
 */
function updateProjectionMatrix() {
    let aspect = gl.canvas.width / gl.canvas.height;
    let p = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, 10);
    gl.uniformMatrix4fv(gl.program.uProjectionMatrix, false, p);
}




/**
 * Render the scene. Must be called once and only once. It will call itself again.
 */
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let [vao, count, mode, texture] = obj;
    gl.bindVertexArray(vao);
    // TODO: bind the texture
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.drawElements(mode, count, gl.UNSIGNED_SHORT, 0);

    // TODO: Cleanup
    gl.bindVertexArray(null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Render again
    window.requestAnimationFrame(render);
}


/**
 * Create a checkerboard image of white and black squares. The image will be size-by-size pixels.
 * There will be a total of num_checks boxes in each direction for a total of num_checks^2.
 */
// function createCheckerboardImage(size, num_checks) {
//     let img = new ImageData(size, size);
//     let data = img.data;
//     let checkSize = size/num_checks;
//     for (let i = 0; i < size; i++) {
//         for (let j = 0; j < size; j++) {
//             let off = 4*(i*size+j);
//             let checkX = Math.floor(i/checkSize)%2;
//             let checkY = Math.floor(j/checkSize)%2;
//             let c = (checkX !== checkY) ? 255 : 0;
//             data[off] = data[off+1] = data[off+2] = c;
//             data[off+3] = 255;
//         }
//     }
//     return img;
// }

function tick() {
    requestAnimationFrame(tick);
    // stats.begin();

    let d = new Date();
    let currentFrame = d.getTime();
    deltaTime = currentFrame - lastFrame;
    lastFrame = currentFrame;

    resizeCanvas();
    handleKeys();
    animate();
    render();

    // stats.end();
}

function deg2rad(degrees) {
    return degrees * Math.PI / 180;
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

function onKeyDown(e) {
    let velocity = this.MovementSpeed * deltaTime;
    if (e.key === 'w') {
        vec3.scaleAndAdd(this.Position ,this.Position,this.Front,velocity );
    } else if (e.key === 's') {
        vec3.scaleAndAdd(this.Position ,this.Position,this.Front,-velocity);
    } else if (e.key === 'a') {
        vec3.scaleAndAdd(this.Position ,this.Position,this.Right,-velocity);
    } else if (e.key === 'd') {
        vec3.scaleAndAdd(this.Position ,this.Position,this.Right,velocity);
    }
}


function generateGrid(gridSize) {
    let i = 0;
    for(let x=0.0; x<gridSize; x+=1.0) {
        for (let z = 0.0; z <gridSize; z += 1.0) {
            this.vertex.push(x, 0.0, z);        //left upper
            this.vertex.push(x+1.0, 0.0, z);
            this.vertex.push(x+1.0, 0.0, z+1.0);
            this.vertex.push(x, 0.0, z+1.0);

            this.texture.push( 0.0, 0.0);
            this.texture.push( 1.0, 0.0);
            this.texture.push( 1.0, 1.0);
            this.texture.push( 0.0, 1.0);

            this.index.push(i);
            this.index.push(i+1);
            this.index.push(i+2);
            this.index.push(i);
            this.index.push(i+2);
            this.index.push(i+3);
            i +=4;
        }
    }
}

function animate() {
    this.i < this.normalTex.image.height ? this.i += 1.0 : this.i = 0.0;
    this.time++;
}
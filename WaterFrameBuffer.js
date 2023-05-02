export default
// NOTE : This class was to be used to create frame buffers for the water reflection and refraction.
//  This was not used in the final submission as we were not able to get reflection and refraction working.
class WaterFrameBuffer {

    constructor(gl) {
        this.gl = gl;

        this.REFLECTION_HEIGHT = 180;
        this.REFLECTION_WIDTH = 320;

        this.REFRACTION_HEIGHT = 720;
        this.REFRACTION_WIDTH = 1280;
        
        this.initReflectionFrameBuffer();
    }

    bindReflectionFrameBuffer() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.reflectionFrameBuffer);
    }

    bindRefractionFrameBuffer() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.refractionFrameBuffer);
    }

    unbindCurrentFrameBuffer() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    }

    getReflectionTexture() {
        return this.reflectionTexture;
    }

    getRefractionTexture() {
        return this.refractionTexture;
    }

    getRefractionDepthTexture() {
        return this.refractionDepthTexture;
    }

    initReflectionFrameBuffer() {
        this.reflectionFrameBuffer = this.gl.createFramebuffer();
        this.bindReflectionFrameBuffer();
        this.reflectionTexture = this.createTextureAttachment(this.REFLECTION_WIDTH, this.REFLECTION_HEIGHT);
        this.reflectionDepthBuffer = this.createDepthBufferAttachment(this.REFLECTION_WIDTH, this.REFLECTION_HEIGHT);
        this.unbindCurrentFrameBuffer();
    }

    initRefractionFrameBuffer() {
        this.refractionFrameBuffer = this.gl.createFramebuffer();
        this.bindRefractionFrameBuffer();
        this.refractionTexture = this.createTextureAttachment(this.REFRACTION_WIDTH, this.REFRACTION_HEIGHT);
        this.refractionDepthTexture = this.createDepthTextureAttachment(this.REFRACTION_WIDTH, this.REFRACTION_HEIGHT);
        this.unbindCurrentFrameBuffer();
    }

    bindFrameBuffer(frameBuffer, width, height) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
        this.gl.bindFrameBuffer(this.gl.FRAMEBUFFER, frameBuffer);
        this.gl.viewport(0, 0, width, height);
    }

    createFrameBuffer() {
        let frameBuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, frameBuffer);
        this.gl.drawBuffers([this.gl.COLOR_ATTACHMENT0]);
        return frameBuffer;
    }

    createTextureAttachment(width, height) {
        let texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0,
            this.gl.RGBA, width, height, 0,
            this.gl.RGBA, this.gl.UNSIGNED_BYTE, null);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);
        return texture;
    }

    createDepthTextureAttachment(width, height) {
        let texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0,
            this.gl.DEPTH_COMPONENT24, width, height, 0,
            this.gl.DEPTH_COMPONENT, this.gl.FLOAT, null);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, texture, 0);
    }

    createDepthBufferAttachment(width, height) {
        let depthBuffer = this.gl.createRenderbuffer();
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, depthBuffer);
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT24,
            width, height);
        this.gl.framebufferRenderbuffer(this.gl.FRAMEBUFFER, this.gl.DEPTH_ATTACHMENT,
            this.gl.RENDERBUFFER, depthBuffer);
        return depthBuffer;
    }

    cleanUp() {
        this.gl.deleteFramebuffer(this.reflectionFrameBuffer);
        this.gl.deleteTexture(this.reflectionTexture);
        this.gl.deleteRenderbuffer(this.reflectionDepthBuffer);
        this.gl.deleteFramebuffer(this.refractionFrameBuffer);
        this.gl.deleteTexture(this.refractionTexture);
        this.gl.deleteTexture(this.refractionDepthTexture);
    }
}
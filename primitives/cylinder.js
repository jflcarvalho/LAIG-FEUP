/**
 * Cylinder
 * @constructor
 */
function Cylinder(scene, height, bottom_radius, top_radius, stacks, slices, has_top_cap, has_bottom_cap) {
    CGFobject.call(this, scene);
    this.has_bottom_cap = has_bottom_cap;
    this.has_top_cap = has_top_cap;
    this.height = height;
    this.body = new CylinderBody(this.scene, height, bottom_radius, top_radius, slices, stacks);
    if(this.has_bottom_cap)
        this.bottom_cap = new Circle(this.scene, slices, bottom_radius);
    if(this.has_top_cap)
        this.top_cap = new Circle(this.scene, slices, top_radius);

};

Cylinder.prototype = Object.create(CGFobject.prototype);
Cylinder.prototype.constructor = Cylinder;

Cylinder.prototype.display = function() {
    this.body.display();
    if (this.has_top_cap) {
        this.scene.pushMatrix();
        this.scene.translate(0, 0, this.height);
        this.top_cap.display();
        this.scene.popMatrix();
    }
    if (this.has_bottom_cap) {
        this.scene.pushMatrix();
        this.scene.rotate(Math.PI, 1, 0, 0);
        this.bottom_cap.display();
        this.scene.popMatrix();
    }
}

Cylinder.prototype.displayOutline = function () {
    this.body.displayOutline();
    if (this.has_top_cap) {
        this.scene.pushMatrix();
        this.scene.translate(0, 0, this.height);
        this.top_cap.displayOutline();
        this.scene.popMatrix();
    }
    if (this.has_bottom_cap) {
        this.scene.pushMatrix();
        this.scene.rotate(Math.PI, 1, 0, 0);
        this.bottom_cap.displayOutline();
        this.scene.popMatrix();
    }
}

/**
 * CylinderBody
 * @constructor
 */
function CylinderBody(scene, height, bottom_radius, top_radius, slices, stacks) {
    CGFobject.call(this, scene);
    this.height = height;
    this.bottom_radius = bottom_radius;
    this.top_radius = top_radius;
    this.slices = slices;
    this.stacks = stacks;
    this.initBuffers();
};

CylinderBody.prototype = Object.create(CGFobject.prototype);
CylinderBody.prototype.constructor = CylinderBody;

CylinderBody.prototype.initBuffers = function() {
    this.vertices = [];
    this.indices = [];
    this.normals = [];
    this.texCoords = [];

    for (stack = 0; stack <= this.stacks; stack++) {
        var theta = 0.0;
        var radius = (this.top_radius - this.bottom_radius) * (stack / this.stacks) + this.bottom_radius;
        var z = this.height * stack / this.stacks;
        var v = 1 - (stack / this.stacks);
        for (slice = 0; slice <= this.slices; slice++) {
            var x = Math.cos(theta) * radius;
            var y = Math.sin(theta) * radius;
            var u = 1 - (slice / this.slices);
            this.vertices.push(x, y, z);
            this.normals.push(x, y, 0);
            this.texCoords.push(u, v);
            theta += 2 * Math.PI / this.slices;
        }
    }

    for (var stack = 0; stack < this.stacks; stack++) {
        for (var slice = 0; slice < this.slices; slice++) {
            var i1 = slice + stack * (this.slices + 1);
            var i2 = slice + stack * (this.slices + 1) + 1;
            var i3 = slice + (stack + 1) * (this.slices + 1);
            var i4 = slice + (stack + 1) * (this.slices + 1) + 1;
            this.indices.push(i4, i3, i1);
            this.indices.push(i1, i2, i4);
        }
    }

    this.primitiveType = this.scene.gl.TRIANGLES;
    this.initGLBuffers();
};
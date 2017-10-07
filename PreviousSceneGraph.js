// let DEGREE_TO_RAD = Math.PI / 180;

// Order of the groups in the XML document.
let INITIALS_INDEX = 0;
let ILLUMINATION_INDEX = 1;
let LIGHTS_INDEX = 2;
let TEXTURES_INDEX = 3;
let MATERIALS_INDEX = 4;
let LEAVES_INDEX = 5;
let NODES_INDEX = 6;

/**
 * MySceneGraph class, representing the scene graph.
 * @constructor
 */
function MySceneGraph(filename, scene) {
    this.loadedOk = null;

    // Establish bidirectional references between scene and graph.
    this.scene = scene;
    scene.graph = this;
	this.nodeIDToIndex = [];
    this.nodeTree = null;
	this.xmlNodes = [];

    this.idRoot = null; // The id of the root element.

    this.axisCoords = [];
    this.axisCoords['x'] = [1, 0, 0];
    this.axisCoords['y'] = [0, 1, 0];
    this.axisCoords['z'] = [0, 0, 1];

    // File reading 
    this.reader = new CGFXMLreader();

    /*
     * Read the contents of the xml file, and refer to this class for loading and error handlers.
     * After the file is read, the reader calls onXMLReady on this object.
     * If any error occurs, the reader calls onXMLError on this object, with an error message
     */

    this.reader.open('scenes/' + filename, this);
}

/*
 * Callback to be executed after successful reading
 */
MySceneGraph.prototype.onXMLReady = function() {
    console.log("XML Loading finished.");
    let rootElement = this.reader.xmlDoc.documentElement;

    // Here should go the calls for different functions to parse the letious blocks
    let error = this.parseLSXFile(rootElement);

    if (error != null) {
        this.onXMLError(error);
        return;
    }

    this.loadedOk = true;

    // As the graph loaded ok, signal the scene so that any additional initialization depending on the graph can take place
    this.scene.onGraphLoaded();
}

/**
 * Parses the LSX file, processing each block.
 */
MySceneGraph.prototype.parseLSXFile = function(rootElement) {
    if (rootElement.nodeName != "SCENE")
        return "root tag <SCENE> missing";

    let nodes = rootElement.children;

    // Reads the names of the nodes to an auxiliary buffer.
    let nodeNames = [];

    for (let i = 0; i < nodes.length; i++) {
        nodeNames.push(nodes[i].nodeName);
    }

    let error;

    // Processes each node, verifying errors.

    // <INITIALS>
    let index;
    if ((index = nodeNames.indexOf("INITIALS")) == -1)
        return "tag <INITIALS> missing";
    else {
        if (index != INITIALS_INDEX)
            this.onXMLMinorError("tag <INITIALS> out of order");

        if ((error = this.parseInitials(nodes[index])) != null)
            return error;
    }

    // <ILLUMINATION>
    if ((index = nodeNames.indexOf("ILLUMINATION")) == -1)
        return "tag <ILLUMINATION> missing";
    else {
        if (index != ILLUMINATION_INDEX)
            this.onXMLMinorError("tag <ILLUMINATION> out of order");

        if ((error = this.parseIllumination(nodes[index])) != null)
            return error;
    }

    // <LIGHTS>
    if ((index = nodeNames.indexOf("LIGHTS")) == -1)
        return "tag <LIGHTS> missing";
    else {
        if (index != LIGHTS_INDEX)
            this.onXMLMinorError("tag <LIGHTS> out of order");

        if ((error = this.parseLights(nodes[index])) != null)
            return error;
    }

    // <TEXTURES>
    if ((index = nodeNames.indexOf("TEXTURES")) == -1)
        return "tag <TEXTURES> missing";
    else {
        if (index != TEXTURES_INDEX)
            this.onXMLMinorError("tag <TEXTURES> out of order");

        if ((error = this.parseTextures(nodes[index])) != null)
            return error;
    }

    // <MATERIALS>
    if ((index = nodeNames.indexOf("MATERIALS")) == -1)
        return "tag <MATERIALS> missing";
    else {
        if (index != MATERIALS_INDEX)
            this.onXMLMinorError("tag <MATERIALS> out of order");

        if ((error = this.parseMaterials(nodes[index])) != null)
            return error;
    }

    // <NODES>
    if ((index = nodeNames.indexOf("NODES")) == -1)
        return "tag <NODES> missing";
    else {
        if (index != NODES_INDEX)
            this.onXMLMinorError("tag <NODES> out of order");

        if ((error = this.parseNodes(nodes[index])) != null)
            return error;
    }

}

/**
 * Parses the <INITIALS> block.
 */
MySceneGraph.prototype.parseInitials = function(initialsNode) {

    let children = initialsNode.children;

    let nodeNames = [];

    for (let i = 0; i < children.length; i++)
        nodeNames.push(children[i].nodeName);

    // Frustum planes.
    this.near = 0.1;
    this.far = 500;
    let indexFrustum = nodeNames.indexOf("frustum");
    if (indexFrustum == -1) {
        this.onXMLMinorError("frustum planes missing; assuming 'near = 0.1' and 'far = 500'");
    } else {
        this.near = this.reader.getFloat(children[indexFrustum], 'near');
        this.far = this.reader.getFloat(children[indexFrustum], 'far');

        if (this.near == null) {
            this.near = 0.1;
            this.onXMLMinorError("unable to parse value for near plane; assuming 'near = 0.1'");
        } else if (this.far == null) {
            this.far = 500;
            this.onXMLMinorError("unable to parse value for far plane; assuming 'far = 500'");
        } else if (isNaN(this.near)) {
            this.near = 0.1;
            this.onXMLMinorError("non-numeric value found for near plane; assuming 'near = 0.1'");
        } else if (isNaN(this.far)) {
            this.far = 500;
            this.onXMLMinorError("non-numeric value found for far plane; assuming 'far = 500'");
        } else if (this.near <= 0) {
            this.near = 0.1;
            this.onXMLMinorError("'near' must be positive; assuming 'near = 0.1'");
        }

        if (this.near >= this.far)
            return "'near' must be smaller than 'far'";
    }

    // Checks if at most one translation, three rotations, and one scaling are defined.
    if (initialsNode.getElementsByTagName('translation').length > 1)
        return "no more than one initial translation may be defined";

    if (initialsNode.getElementsByTagName('rotation').length > 3)
        return "no more than three initial rotations may be defined";

    if (initialsNode.getElementsByTagName('scale').length > 1)
        return "no more than one scaling may be defined";

    // Initial transforms.
    this.initialTranslate = [];
    this.initialScaling = [];
    this.initialRotations = [];

    // Gets indices of each element.
    let translationIndex = nodeNames.indexOf("translation");
    let thirdRotationIndex = nodeNames.indexOf("rotation");
    let secondRotationIndex = nodeNames.indexOf("rotation", thirdRotationIndex + 1);
    let firstRotationIndex = nodeNames.lastIndexOf("rotation");
    let scalingIndex = nodeNames.indexOf("scale");

    // Checks if the indices are valid and in the expected order.
    // Translation.
    this.initialTransforms = mat4.create();
    mat4.identity(this.initialTransforms);
    if (translationIndex == -1)
        this.onXMLMinorError("initial translation undefined; assuming T = (0, 0, 0)");
    else {
        let tx = this.reader.getFloat(children[translationIndex], 'x');
        let ty = this.reader.getFloat(children[translationIndex], 'y');
        let tz = this.reader.getFloat(children[translationIndex], 'z');

        if (tx == null) {
            tx = 0;
            this.onXMLMinorError("failed to parse x-coordinate of initial translation; assuming tx = 0");
        } else if (isNaN(tx)) {
            tx = 0;
            this.onXMLMinorError("found non-numeric value for x-coordinate of initial translation; assuming tx = 0");
        }

        if (ty == null) {
            ty = 0;
            this.onXMLMinorError("failed to parse y-coordinate of initial translation; assuming ty = 0");
        } else if (isNaN(ty)) {
            ty = 0;
            this.onXMLMinorError("found non-numeric value for y-coordinate of initial translation; assuming ty = 0");
        }

        if (tz == null) {
            tz = 0;
            this.onXMLMinorError("failed to parse z-coordinate of initial translation; assuming tz = 0");
        } else if (isNaN(tz)) {
            tz = 0;
            this.onXMLMinorError("found non-numeric value for z-coordinate of initial translation; assuming tz = 0");
        }

        if (translationIndex > thirdRotationIndex || translationIndex > scalingIndex)
            this.onXMLMinorError("initial translation out of order; result may not be as expected");

        mat4.translate(this.initialTransforms, this.initialTransforms, [tx, ty, tz]);
    }

    // Rotations.
    let initialRotations = [];
    initialRotations['x'] = 0;
    initialRotations['y'] = 0;
    initialRotations['z'] = 0;

    let rotationDefined = [];
    rotationDefined['x'] = false;
    rotationDefined['y'] = false;
    rotationDefined['z'] = false;

    let axis;
    let rotationOrder = [];

    // Third rotation (first rotation defined).
    if (thirdRotationIndex != -1) {
        axis = this.reader.getItem(children[thirdRotationIndex], 'axis', ['x', 'y', 'z']);
        if (axis != null) {
            let angle = this.reader.getFloat(children[thirdRotationIndex], 'angle');
            if (angle != null && !isNaN(angle)) {
                initialRotations[axis] += angle;
                if (!rotationDefined[axis])
                    rotationOrder.push(axis);
                rotationDefined[axis] = true;
            } else this.onXMLMinorError("failed to parse third initial rotation 'angle'");
        }
    }

    // Second rotation.
    if (secondRotationIndex != -1) {
        axis = this.reader.getItem(children[secondRotationIndex], 'axis', ['x', 'y', 'z']);
        if (axis != null) {
            let angle = this.reader.getFloat(children[secondRotationIndex], 'angle');
            if (angle != null && !isNaN(angle)) {
                initialRotations[axis] += angle;
                if (!rotationDefined[axis])
                    rotationOrder.push(axis);
                rotationDefined[axis] = true;
            } else this.onXMLMinorError("failed to parse second initial rotation 'angle'");
        }
    }

    // First rotation.
    if (firstRotationIndex != -1) {
        axis = this.reader.getItem(children[firstRotationIndex], 'axis', ['x', 'y', 'z']);
        if (axis != null) {
            let angle = this.reader.getFloat(children[firstRotationIndex], 'angle');
            if (angle != null && !isNaN(angle)) {
                initialRotations[axis] += angle;
                if (!rotationDefined[axis])
                    rotationOrder.push(axis);
                rotationDefined[axis] = true;
            } else this.onXMLMinorError("failed to parse first initial rotation 'angle'");
        }
    }

    // Checks for undefined rotations.
    if (!rotationDefined['x'])
        this.onXMLMinorError("rotation along the Ox axis undefined; assuming Rx = 0");
    else if (!rotationDefined['y'])
        this.onXMLMinorError("rotation along the Oy axis undefined; assuming Ry = 0");
    else if (!rotationDefined['z'])
        this.onXMLMinorError("rotation along the Oz axis undefined; assuming Rz = 0");

    // Updates transform matrix.
    for (let i = 0; i < rotationOrder.length; i++)
        mat4.rotate(this.initialTransforms, this.initialTransforms, DEGREE_TO_RAD * initialRotations[rotationOrder[i]], this.axisCoords[rotationOrder[i]]);

    // Scaling.
    if (scalingIndex == -1)
        this.onXMLMinorError("initial scaling undefined; assuming S = (1, 1, 1)");
    else {
        let sx = this.reader.getFloat(children[scalingIndex], 'sx');
        let sy = this.reader.getFloat(children[scalingIndex], 'sy');
        let sz = this.reader.getFloat(children[scalingIndex], 'sz');

        if (sx == null) {
            sx = 1;
            this.onXMLMinorError("failed to parse x parameter of initial scaling; assuming sx = 1");
        } else if (isNaN(sx)) {
            sx = 1;
            this.onXMLMinorError("found non-numeric value for x parameter of initial scaling; assuming sx = 1");
        }

        if (sy == null) {
            sy = 1;
            this.onXMLMinorError("failed to parse y parameter of initial scaling; assuming sy = 1");
        } else if (isNaN(sy)) {
            sy = 1;
            this.onXMLMinorError("found non-numeric value for y parameter of initial scaling; assuming sy = 1");
        }

        if (sz == null) {
            sz = 1;
            this.onXMLMinorError("failed to parse z parameter of initial scaling; assuming sz = 1");
        } else if (isNaN(sz)) {
            sz = 1;
            this.onXMLMinorError("found non-numeric value for z parameter of initial scaling; assuming sz = 1");
        }

        if (scalingIndex < firstRotationIndex)
            this.onXMLMinorError("initial scaling out of order; result may not be as expected");

        mat4.scale(this.initialTransforms, this.initialTransforms, [sx, sy, sz]);
    }

    // ----------
    // Reference length.
    this.referenceLength = 1;

    let indexReference = nodeNames.indexOf("reference");
    if (indexReference == -1)
        this.onXMLMinorError("reference length undefined; assuming 'length = 1'");
    else {
        // Reads the reference length.
        let length = this.reader.getFloat(children[indexReference], 'length');

        if (length != null) {
            if (isNaN(length))
                this.onXMLMinorError("found non-numeric value for reference length; assuming 'length = 1'");
            else if (length <= 0)
                this.onXMLMinorError("reference length must be a positive value; assuming 'length = 1'");
            else
                this.referenceLength = length;
        } else
            this.onXMLMinorError("unable to parse reference length; assuming 'length = 1'");

    }

    console.log("Parsed initials");

    return null;
}

/**
 * Parses the <ILLUMINATION> block.
 */
MySceneGraph.prototype.parseIllumination = function(illuminationNode) {

    // Reads the ambient and background values.
    let children = illuminationNode.children;
    let nodeNames = [];
    for (let i = 0; i < children.length; i++)
        nodeNames.push(children[i].nodeName);

    // Retrieves the global ambient illumination.
    this.ambientIllumination = [0, 0, 0, 1];
    let ambientIndex = nodeNames.indexOf("ambient");
    if (ambientIndex != -1) {
        // R.
        let r = this.reader.getFloat(children[ambientIndex], 'r');
        if (r != null) {
            if (isNaN(r))
                return "ambient 'r' is a non numeric value on the ILLUMINATION block";
            else if (r < 0 || r > 1)
                return "ambient 'r' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.ambientIllumination[0] = r;
        } else
            this.onXMLMinorError("unable to parse R component of the ambient illumination; assuming R = 0");

        // G.
        let g = this.reader.getFloat(children[ambientIndex], 'g');
        if (g != null) {
            if (isNaN(g))
                return "ambient 'g' is a non numeric value on the ILLUMINATION block";
            else if (g < 0 || g > 1)
                return "ambient 'g' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.ambientIllumination[1] = g;
        } else
            this.onXMLMinorError("unable to parse G component of the ambient illumination; assuming G = 0");

        // B.
        let b = this.reader.getFloat(children[ambientIndex], 'b');
        if (b != null) {
            if (isNaN(b))
                return "ambient 'b' is a non numeric value on the ILLUMINATION block";
            else if (b < 0 || b > 1)
                return "ambient 'b' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.ambientIllumination[2] = b;
        } else
            this.onXMLMinorError("unable to parse B component of the ambient illumination; assuming B = 0");

        // A.
        let a = this.reader.getFloat(children[ambientIndex], 'a');
        if (a != null) {
            if (isNaN(a))
                return "ambient 'a' is a non numeric value on the ILLUMINATION block";
            else if (a < 0 || a > 1)
                return "ambient 'a' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.ambientIllumination[3] = a;
        } else
            this.onXMLMinorError("unable to parse A component of the ambient illumination; assuming A = 1");
    } else
        this.onXMLMinorError("global ambient illumination undefined; assuming Ia = (0, 0, 0, 1)");

    // Retrieves the background clear color.
    this.background = [0, 0, 0, 1];
    let backgroundIndex = nodeNames.indexOf("background");
    if (backgroundIndex != -1) {
        // R.
        let r = this.reader.getFloat(children[backgroundIndex], 'r');
        if (r != null) {
            if (isNaN(r))
                return "background 'r' is a non numeric value on the ILLUMINATION block";
            else if (r < 0 || r > 1)
                return "background 'r' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.background[0] = r;
        } else
            this.onXMLMinorError("unable to parse R component of the background colour; assuming R = 0");

        // G.
        let g = this.reader.getFloat(children[backgroundIndex], 'g');
        if (g != null) {
            if (isNaN(g))
                return "background 'g' is a non numeric value on the ILLUMINATION block";
            else if (g < 0 || g > 1)
                return "background 'g' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.background[1] = g;
        } else
            this.onXMLMinorError("unable to parse G component of the background colour; assuming G = 0");

        // B.
        let b = this.reader.getFloat(children[backgroundIndex], 'b');
        if (b != null) {
            if (isNaN(b))
                return "background 'b' is a non numeric value on the ILLUMINATION block";
            else if (b < 0 || b > 1)
                return "background 'b' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.background[2] = b;
        } else
            this.onXMLMinorError("unable to parse B component of the background colour; assuming B = 0");

        // A.
        let a = this.reader.getFloat(children[backgroundIndex], 'a');
        if (a != null) {
            if (isNaN(a))
                return "background 'a' is a non numeric value on the ILLUMINATION block";
            else if (a < 0 || a > 1)
                return "background 'a' must be a value between 0 and 1 on the ILLUMINATION block"
            else
                this.background[3] = a;
        } else
            this.onXMLMinorError("unable to parse A component of the background colour; assuming A = 1");
    } else
        this.onXMLMinorError("background clear colour undefined; assuming (R, G, B, A) = (0, 0, 0, 1)");

    console.log("Parsed illumination");

    return null;
}

/**
 * Parses the <LIGHTS> node.
 */
MySceneGraph.prototype.parseLights = function(lightsNode) {

    let children = lightsNode.children;

    this.lights = [];
    let numLights = 0;

    let grandChildren = [];
    let nodeNames = [];

    // Any number of lights.
    for (let i = 0; i < children.length; i++) {

        if (children[i].nodeName != "LIGHT") {
            this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
            continue;
        }

        // Get id of the current light.
        let lightId = this.reader.getString(children[i], 'id');
        if (lightId == null)
            return "no ID defined for light";

        // Checks for repeated IDs.
        if (this.lights[lightId] != null)
            return "ID must be unique for each light (conflict: ID = " + lightId + ")";

        grandChildren = children[i].children;
        // Specifications for the current light.

        nodeNames = [];
        for (let j = 0; j < grandChildren.length; j++) {
            console.log(grandChildren[j].nodeName);
            nodeNames.push(grandChildren[j].nodeName);
        }

        // Gets indices of each element.
        let enableIndex = nodeNames.indexOf("enable");
        let positionIndex = nodeNames.indexOf("position");
        let ambientIndex = nodeNames.indexOf("ambient");
        let diffuseIndex = nodeNames.indexOf("diffuse");
        let specularIndex = nodeNames.indexOf("specular");

        // Light enable/disable
        let enableLight = true;
        if (enableIndex == -1) {
            this.onXMLMinorError("enable value missing for ID = " + lightId + "; assuming 'value = 1'");
        } else {
            let aux = this.reader.getFloat(grandChildren[enableIndex], 'value');
            if (aux == null) {
                this.onXMLMinorError("unable to parse value component of the 'enable light' field for ID = " + lightId + "; assuming 'value = 1'");
            } else if (isNaN(aux))
                return "'enable value' is a non numeric value on the LIGHTS block";
            else if (aux != 0 && aux != 1)
                return "'enable value' must be 0 or 1 on the LIGHTS block"
            else
                enableLight = aux == 0 ? false : true;
        }

        // Retrieves the light position.
        let positionLight = [];
        if (positionIndex != -1) {
            // x
            let x = this.reader.getFloat(grandChildren[positionIndex], 'x');
            if (x != null) {
                if (isNaN(x))
                    return "'x' is a non numeric value on the LIGHTS block";
                else
                    positionLight.push(x);
            } else
                return "unable to parse x-coordinate of the light position for ID = " + lightId;

            // y
            let y = this.reader.getFloat(grandChildren[positionIndex], 'y');
            if (y != null) {
                if (isNaN(y))
                    return "'y' is a non numeric value on the LIGHTS block";
                else
                    positionLight.push(y);
            } else
                return "unable to parse y-coordinate of the light position for ID = " + lightId;

            // z
            let z = this.reader.getFloat(grandChildren[positionIndex], 'z');
            if (z != null) {
                if (isNaN(z))
                    return "'z' is a non numeric value on the LIGHTS block";
                else
                    positionLight.push(z);
            } else
                return "unable to parse z-coordinate of the light position for ID = " + lightId;

            // w
            let w = this.reader.getFloat(grandChildren[positionIndex], 'w');
            if (w != null) {
                if (isNaN(w))
                    return "'w' is a non numeric value on the LIGHTS block";
                else if (w < 0 || w > 1)
                    return "'w' must be a value between 0 and 1 on the LIGHTS block"
                else
                    positionLight.push(w);
            } else
                return "unable to parse w-coordinate of the light position for ID = " + lightId;
        } else
            return "light position undefined for ID = " + lightId;

        // Retrieves the ambient component.
        let ambientIllumination = [];
        if (ambientIndex != -1) {
            // R
            let r = this.reader.getFloat(grandChildren[ambientIndex], 'r');
            if (r != null) {
                if (isNaN(r))
                    return "ambient 'r' is a non numeric value on the LIGHTS block";
                else if (r < 0 || r > 1)
                    return "ambient 'r' must be a value between 0 and 1 on the LIGHTS block"
                else
                    ambientIllumination.push(r);
            } else
                return "unable to parse R component of the ambient illumination for ID = " + lightId;

            // G
            let g = this.reader.getFloat(grandChildren[ambientIndex], 'g');
            if (g != null) {
                if (isNaN(g))
                    return "ambient 'g' is a non numeric value on the LIGHTS block";
                else if (g < 0 || g > 1)
                    return "ambient 'g' must be a value between 0 and 1 on the LIGHTS block"
                else
                    ambientIllumination.push(g);
            } else
                return "unable to parse G component of the ambient illumination for ID = " + lightId;

            // B
            let b = this.reader.getFloat(grandChildren[ambientIndex], 'b');
            if (b != null) {
                if (isNaN(b))
                    return "ambient 'b' is a non numeric value on the LIGHTS block";
                else if (b < 0 || b > 1)
                    return "ambient 'b' must be a value between 0 and 1 on the LIGHTS block"
                else
                    ambientIllumination.push(b);
            } else
                return "unable to parse B component of the ambient illumination for ID = " + lightId;

            // A
            let a = this.reader.getFloat(grandChildren[ambientIndex], 'a');
            if (a != null) {
                if (isNaN(a))
                    return "ambient 'a' is a non numeric value on the LIGHTS block";
                else if (a < 0 || a > 1)
                    return "ambient 'a' must be a value between 0 and 1 on the LIGHTS block"
                ambientIllumination.push(a);
            } else
                return "unable to parse A component of the ambient illumination for ID = " + lightId;
        } else
            return "ambient component undefined for ID = " + lightId;

        // Retrieves the diffuse component
        let diffuseIllumination = [];
        if (diffuseIndex != -1) {
            // R
            let r = this.reader.getFloat(grandChildren[diffuseIndex], 'r');
            if (r != null) {
                if (isNaN(r))
                    return "diffuse 'r' is a non numeric value on the LIGHTS block";
                else if (r < 0 || r > 1)
                    return "diffuse 'r' must be a value between 0 and 1 on the LIGHTS block"
                else
                    diffuseIllumination.push(r);
            } else
                return "unable to parse R component of the diffuse illumination for ID = " + lightId;

            // G
            let g = this.reader.getFloat(grandChildren[diffuseIndex], 'g');
            if (g != null) {
                if (isNaN(g))
                    return "diffuse 'g' is a non numeric value on the LIGHTS block";
                else if (g < 0 || g > 1)
                    return "diffuse 'g' must be a value between 0 and 1 on the LIGHTS block"
                else
                    diffuseIllumination.push(g);
            } else
                return "unable to parse G component of the diffuse illumination for ID = " + lightId;

            // B
            let b = this.reader.getFloat(grandChildren[diffuseIndex], 'b');
            if (b != null) {
                if (isNaN(b))
                    return "diffuse 'b' is a non numeric value on the LIGHTS block";
                else if (b < 0 || b > 1)
                    return "diffuse 'b' must be a value between 0 and 1 on the LIGHTS block"
                else
                    diffuseIllumination.push(b);
            } else
                return "unable to parse B component of the diffuse illumination for ID = " + lightId;

            // A
            let a = this.reader.getFloat(grandChildren[diffuseIndex], 'a');
            if (a != null) {
                if (isNaN(a))
                    return "diffuse 'a' is a non numeric value on the LIGHTS block";
                else if (a < 0 || a > 1)
                    return "diffuse 'a' must be a value between 0 and 1 on the LIGHTS block"
                else
                    diffuseIllumination.push(a);
            } else
                return "unable to parse A component of the diffuse illumination for ID = " + lightId;
        } else
            return "diffuse component undefined for ID = " + lightId;

        // Retrieves the specular component
        let specularIllumination = [];
        if (specularIndex != -1) {
            // R
            let r = this.reader.getFloat(grandChildren[specularIndex], 'r');
            if (r != null) {
                if (isNaN(r))
                    return "specular 'r' is a non numeric value on the LIGHTS block";
                else if (r < 0 || r > 1)
                    return "specular 'r' must be a value between 0 and 1 on the LIGHTS block"
                else
                    specularIllumination.push(r);
            } else
                return "unable to parse R component of the specular illumination for ID = " + lightId;

            // G
            let g = this.reader.getFloat(grandChildren[specularIndex], 'g');
            if (g != null) {
                if (isNaN(g))
                    return "specular 'g' is a non numeric value on the LIGHTS block";
                else if (g < 0 || g > 1)
                    return "specular 'g' must be a value between 0 and 1 on the LIGHTS block"
                else
                    specularIllumination.push(g);
            } else
                return "unable to parse G component of the specular illumination for ID = " + lightId;

            // B
            let b = this.reader.getFloat(grandChildren[specularIndex], 'b');
            if (b != null) {
                if (isNaN(b))
                    return "specular 'b' is a non numeric value on the LIGHTS block";
                else if (b < 0 || b > 1)
                    return "specular 'b' must be a value between 0 and 1 on the LIGHTS block"
                else
                    specularIllumination.push(b);
            } else
                return "unable to parse B component of the specular illumination for ID = " + lightId;

            // A
            let a = this.reader.getFloat(grandChildren[specularIndex], 'a');
            if (a != null) {
                if (isNaN(a))
                    return "specular 'a' is a non numeric value on the LIGHTS block";
                else if (a < 0 || a > 1)
                    return "specular 'a' must be a value between 0 and 1 on the LIGHTS block"
                else
                    specularIllumination.push(a);
            } else
                return "unable to parse A component of the specular illumination for ID = " + lightId;
        } else
            return "specular component undefined for ID = " + lightId;

        // Light global information.
        this.lights[lightId] = [enableLight, positionLight, ambientIllumination, diffuseIllumination, specularIllumination];
        numLights++;
    }

    if (numLights == 0)
        return "at least one light must be defined";
    else if (numLights > 8)
        this.onXMLMinorError("too many lights defined; WebGL imposes a limit of 8 lights");

    console.log("Parsed lights");

    return null;
}

/**
 * Parses the <TEXTURES> block.
 */
MySceneGraph.prototype.parseTextures = function(texturesNode) {

    this.textures = [];

    let eachTexture = texturesNode.children;
    // Each texture.

    let oneTextureDefined = false;

    for (let i = 0; i < eachTexture.length; i++) {
        let nodeName = eachTexture[i].nodeName;
        if (nodeName == "TEXTURE") {
            // Retrieves texture ID.
            let textureID = this.reader.getString(eachTexture[i], 'id');
            if (textureID == null)
                return "failed to parse texture ID";
            // Checks if ID is valid.
            if (this.textures[textureID] != null)
                return "texture ID must unique (conflict with ID = " + textureID + ")";

            let texSpecs = eachTexture[i].children;
            let filepath = null;
            let amplifFactorS = null;
            let amplifFactorT = null;
            // Retrieves texture specifications.
            for (let j = 0; j < texSpecs.length; j++) {
                let name = texSpecs[j].nodeName;
                if (name == "file") {
                    if (filepath != null)
                        return "duplicate file paths in texture with ID = " + textureID;

                    filepath = this.reader.getString(texSpecs[j], 'path');
                    if (filepath == null)
                        return "unable to parse texture file path for ID = " + textureID;
                } else if (name == "amplif_factor") {
                    if (amplifFactorS != null || amplifFactorT != null)
                        return "duplicate amplification factors in texture with ID = " + textureID;

                    amplifFactorS = this.reader.getFloat(texSpecs[j], 's');
                    amplifFactorT = this.reader.getFloat(texSpecs[j], 't');

                    if (amplifFactorS == null || amplifFactorT == null)
                        return "unable to parse texture amplification factors for ID = " + textureID;
                    else if (isNaN(amplifFactorS))
                        return "'amplifFactorS' is a non numeric value";
                    else if (isNaN(amplifFactorT))
                        return "'amplifFactorT' is a non numeric value";
                    else if (amplifFactorS <= 0 || amplifFactorT <= 0)
                        return "value for amplifFactor must be positive";
                } else
                    this.onXMLMinorError("unknown tag name <" + name + ">");
            }

            if (filepath == null)
                return "file path undefined for texture with ID = " + textureID;
            else if (amplifFactorS == null)
                return "s amplification factor undefined for texture with ID = " + textureID;
            else if (amplifFactorT == null)
                return "t amplification factor undefined for texture with ID = " + textureID;

            let texture = new CGFtexture(this.scene, "./scenes/" + filepath);

            this.textures[textureID] = [texture, amplifFactorS, amplifFactorT];
            oneTextureDefined = true;
        } else
            this.onXMLMinorError("unknown tag name <" + nodeName + ">");
    }

    if (!oneTextureDefined)
        return "at least one texture must be defined in the TEXTURES block";

    console.log("Parsed textures");
}

/**
 * Parses the <MATERIALS> node.
 */
MySceneGraph.prototype.parseMaterials = function(materialsNode) {

    let children = materialsNode.children;
    // Each material.

    this.materials = [];

    let oneMaterialDefined = false;

    for (let i = 0; i < children.length; i++) {
        if (children[i].nodeName != "MATERIAL") {
            this.onXMLMinorError("unknown tag name <" + children[i].nodeName + ">");
            continue;
        }

        let materialID = this.reader.getString(children[i], 'id');
        if (materialID == null)
            return "no ID defined for material";

        if (this.materials[materialID] != null)
            return "ID must be unique for each material (conflict: ID = " + materialID + ")";

        let materialSpecs = children[i].children;

        let nodeNames = [];

        for (let j = 0; j < materialSpecs.length; j++)
            nodeNames.push(materialSpecs[j].nodeName);

        // Determines the values for each field.
        // Shininess.
        let shininessIndex = nodeNames.indexOf("shininess");
        if (shininessIndex == -1)
            return "no shininess value defined for material with ID = " + materialID;
        let shininess = this.reader.getFloat(materialSpecs[shininessIndex], 'value');
        if (shininess == null)
            return "unable to parse shininess value for material with ID = " + materialID;
        else if (isNaN(shininess))
            return "'shininess' is a non numeric value";
        else if (shininess <= 0)
            return "'shininess' must be positive";

        // Specular component.
        let specularIndex = nodeNames.indexOf("specular");
        if (specularIndex == -1)
            return "no specular component defined for material with ID = " + materialID;
        let specularComponent = [];
        // R.
        let r = this.reader.getFloat(materialSpecs[specularIndex], 'r');
        if (r == null)
            return "unable to parse R component of specular reflection for material with ID = " + materialID;
        else if (isNaN(r))
            return "specular 'r' is a non numeric value on the MATERIALS block";
        else if (r < 0 || r > 1)
            return "specular 'r' must be a value between 0 and 1 on the MATERIALS block"
        specularComponent.push(r);
        // G.
        let g = this.reader.getFloat(materialSpecs[specularIndex], 'g');
        if (g == null)
            return "unable to parse G component of specular reflection for material with ID = " + materialID;
        else if (isNaN(g))
            return "specular 'g' is a non numeric value on the MATERIALS block";
        else if (g < 0 || g > 1)
            return "specular 'g' must be a value between 0 and 1 on the MATERIALS block";
        specularComponent.push(g);
        // B.
        let b = this.reader.getFloat(materialSpecs[specularIndex], 'b');
        if (b == null)
            return "unable to parse B component of specular reflection for material with ID = " + materialID;
        else if (isNaN(b))
            return "specular 'b' is a non numeric value on the MATERIALS block";
        else if (b < 0 || b > 1)
            return "specular 'b' must be a value between 0 and 1 on the MATERIALS block";
        specularComponent.push(b);
        // A.
        let a = this.reader.getFloat(materialSpecs[specularIndex], 'a');
        if (a == null)
            return "unable to parse A component of specular reflection for material with ID = " + materialID;
        else if (isNaN(a))
            return "specular 'a' is a non numeric value on the MATERIALS block";
        else if (a < 0 || a > 1)
            return "specular 'a' must be a value between 0 and 1 on the MATERIALS block";
        specularComponent.push(a);

        // Diffuse component.
        let diffuseIndex = nodeNames.indexOf("diffuse");
        if (diffuseIndex == -1)
            return "no diffuse component defined for material with ID = " + materialID;
        let diffuseComponent = [];
        // R.
        r = this.reader.getFloat(materialSpecs[diffuseIndex], 'r');
        if (r == null)
            return "unable to parse R component of diffuse reflection for material with ID = " + materialID;
        else if (isNaN(r))
            return "diffuse 'r' is a non numeric value on the MATERIALS block";
        else if (r < 0 || r > 1)
            return "diffuse 'r' must be a value between 0 and 1 on the MATERIALS block";
        diffuseComponent.push(r);
        // G.
        g = this.reader.getFloat(materialSpecs[diffuseIndex], 'g');
        if (g == null)
            return "unable to parse G component of diffuse reflection for material with ID = " + materialID;
        else if (isNaN(g))
            return "diffuse 'g' is a non numeric value on the MATERIALS block";
        else if (g < 0 || g > 1)
            return "diffuse 'g' must be a value between 0 and 1 on the MATERIALS block";
        diffuseComponent.push(g);
        // B.
        b = this.reader.getFloat(materialSpecs[diffuseIndex], 'b');
        if (b == null)
            return "unable to parse B component of diffuse reflection for material with ID = " + materialID;
        else if (isNaN(b))
            return "diffuse 'b' is a non numeric value on the MATERIALS block";
        else if (b < 0 || b > 1)
            return "diffuse 'b' must be a value between 0 and 1 on the MATERIALS block";
        diffuseComponent.push(b);
        // A.
        a = this.reader.getFloat(materialSpecs[diffuseIndex], 'a');
        if (a == null)
            return "unable to parse A component of diffuse reflection for material with ID = " + materialID;
        else if (isNaN(a))
            return "diffuse 'a' is a non numeric value on the MATERIALS block";
        else if (a < 0 || a > 1)
            return "diffuse 'a' must be a value between 0 and 1 on the MATERIALS block";
        diffuseComponent.push(a);

        // Ambient component.
        let ambientIndex = nodeNames.indexOf("ambient");
        if (ambientIndex == -1)
            return "no ambient component defined for material with ID = " + materialID;
        let ambientComponent = [];
        // R.
        r = this.reader.getFloat(materialSpecs[ambientIndex], 'r');
        if (r == null)
            return "unable to parse R component of ambient reflection for material with ID = " + materialID;
        else if (isNaN(r))
            return "ambient 'r' is a non numeric value on the MATERIALS block";
        else if (r < 0 || r > 1)
            return "ambient 'r' must be a value between 0 and 1 on the MATERIALS block";
        ambientComponent.push(r);
        // G.
        g = this.reader.getFloat(materialSpecs[ambientIndex], 'g');
        if (g == null)
            return "unable to parse G component of ambient reflection for material with ID = " + materialID;
        else if (isNaN(g))
            return "ambient 'g' is a non numeric value on the MATERIALS block";
        else if (g < 0 || g > 1)
            return "ambient 'g' must be a value between 0 and 1 on the MATERIALS block";
        ambientComponent.push(g);
        // B.
        b = this.reader.getFloat(materialSpecs[ambientIndex], 'b');
        if (b == null)
            return "unable to parse B component of ambient reflection for material with ID = " + materialID;
        else if (isNaN(b))
            return "ambient 'b' is a non numeric value on the MATERIALS block";
        else if (b < 0 || b > 1)
            return "ambient 'b' must be a value between 0 and 1 on the MATERIALS block";
        ambientComponent.push(b);
        // A.
        a = this.reader.getFloat(materialSpecs[ambientIndex], 'a');
        if (a == null)
            return "unable to parse A component of ambient reflection for material with ID = " + materialID;
        else if (isNaN(a))
            return "ambient 'a' is a non numeric value on the MATERIALS block";
        else if (a < 0 || a > 1)
            return "ambient 'a' must be a value between 0 and 1 on the MATERIALS block";
        ambientComponent.push(a);

        // Emission component.
        let emissionIndex = nodeNames.indexOf("emission");
        if (emissionIndex == -1)
            return "no emission component defined for material with ID = " + materialID;
        let emissionComponent = [];
        // R.
        r = this.reader.getFloat(materialSpecs[emissionIndex], 'r');
        if (r == null)
            return "unable to parse R component of emission for material with ID = " + materialID;
        else if (isNaN(r))
            return "emisson 'r' is a non numeric value on the MATERIALS block";
        else if (r < 0 || r > 1)
            return "emisson 'r' must be a value between 0 and 1 on the MATERIALS block";
        emissionComponent.push(r);
        // G.
        g = this.reader.getFloat(materialSpecs[emissionIndex], 'g');
        if (g == null)
            return "unable to parse G component of emission for material with ID = " + materialID;
        if (isNaN(g))
            return "emisson 'g' is a non numeric value on the MATERIALS block";
        else if (g < 0 || g > 1)
            return "emisson 'g' must be a value between 0 and 1 on the MATERIALS block";
        emissionComponent.push(g);
        // B.
        b = this.reader.getFloat(materialSpecs[emissionIndex], 'b');
        if (b == null)
            return "unable to parse B component of emission for material with ID = " + materialID;
        else if (isNaN(b))
            return "emisson 'b' is a non numeric value on the MATERIALS block";
        else if (b < 0 || b > 1)
            return "emisson 'b' must be a value between 0 and 1 on the MATERIALS block";
        emissionComponent.push(b);
        // A.
        a = this.reader.getFloat(materialSpecs[emissionIndex], 'a');
        if (a == null)
            return "unable to parse A component of emission for material with ID = " + materialID;
        else if (isNaN(a))
            return "emisson 'a' is a non numeric value on the MATERIALS block";
        else if (a < 0 || a > 1)
            return "emisson 'a' must be a value between 0 and 1 on the MATERIALS block";
        emissionComponent.push(a);

        // Creates material with the specified characteristics.
        let newMaterial = new CGFappearance(this.scene);
        newMaterial.setShininess(shininess);
        newMaterial.setAmbient(ambientComponent[0], ambientComponent[1], ambientComponent[2], ambientComponent[3]);
        newMaterial.setDiffuse(diffuseComponent[0], diffuseComponent[1], diffuseComponent[2], diffuseComponent[3]);
        newMaterial.setSpecular(specularComponent[0], specularComponent[1], specularComponent[2], specularComponent[3]);
        newMaterial.setEmission(emissionComponent[0], emissionComponent[1], emissionComponent[2], emissionComponent[3]);
        this.materials[materialID] = newMaterial;
        oneMaterialDefined = true;
    }

    if (!oneMaterialDefined)
        return "at least one material must be defined on the MATERIALS block";

    // Generates a default material.
    this.generateDefaultMaterial();

    console.log("Parsed materials");
}

MySceneGraph.prototype.getAttributeOfSpec = function(nodeSpecs,specIndex, attributeName) {
	let specID = this.reader.getString(nodeSpecs[specIndex],attributeName);
	if (specID == null) {
		this.onXMLMinorError("Unable to parse " + specName + "of node");
	}
	return specID;
}

MySceneGraph.prototype.parseNode = function(nodeToParse) {
    let nodeID = this.reader.getString(nodeToParse,'id');
    let newNode = new MyGraphNode(nodeID);
	let nodeSpecs = nodeToParse.children;
	let specNames = new Array();
	let possibleValues = ["MATERIAL", "TEXTURE", "TRANSLATION", "ROTATION", "SCALE", "DESCENDANTS"];
	for (let j = 0; j < nodeSpecs.length; j++) {
		let specName = nodeSpecs[j].nodeName;
		specNames.push(specName);

		// Warns against possible invalid tag names.
		if (possibleValues.indexOf(specName) == -1)
			this.onXMLMinorError("unknown tag <" + specName + ">");
	}
	// Process Material
	let indexOfMaterial = specNames.indexOf("MATERIAL");
	if (indexOfMaterial > -1) {
		newNode.materialID = this.getAttributeOfSpec(nodeSpecs,indexOfMaterial,'id');
	}
	// Process texture
	let indexOfTexture = specNames.indexOf("TEXTURE");
	if (indexOfTexture > -1) {
		newNode.textureID = this.getAttributeOfSpec(nodeSpecs,indexOfTexture,'id');
	}
	// Process transformations
	// Retrieves possible transformations.
	for (let j = 0; j < nodeSpecs.length; j++) {
		switch (nodeSpecs[j].nodeName) {
			case "TRANSLATION":
				// Retrieves translation parameters.
				let x = this.reader.getFloat(nodeSpecs[j], 'x');
				if (x == null || isNaN(x)) {
					this.onXMLMinorError("unable to parse x-coordinate of translation; discarding transform");
					break;
				}
				let y = this.reader.getFloat(nodeSpecs[j], 'y');
				if (y == null || isNaN(y)) {
					this.onXMLMinorError("unable to parse y-coordinate of translation; discarding transform");
					break;
				}
				let z = this.reader.getFloat(nodeSpecs[j], 'z');
				if (z == null || isNaN(z)) {
					this.onXMLMinorError("unable to parse z-coordinate of translation; discarding transform");
					break;
				}
				mat4.translate(newNode.transformMatrix, newNode.transformMatrix, [x, y, z]);
				break;
			case "ROTATION":
				// Retrieves rotation parameters.
				let axis = this.reader.getItem(nodeSpecs[j], 'axis', ['x', 'y', 'z']);
				if (axis == null) {
					this.onXMLMinorError("unable to parse rotation axis; discarding transform");
					break;
				}
				let angle = this.reader.getFloat(nodeSpecs[j], 'angle');
				if (angle == null || isNaN(angle)) {
					this.onXMLMinorError("unable to parse rotation angle; discarding transform");
					break;
				}

				mat4.rotate(newNode.transformMatrix, newNode.transformMatrix, angle * DEGREE_TO_RAD, this.axisCoords[axis]);
				break;
			case "SCALE":
				// Retrieves scale parameters.
				let sx = this.reader.getFloat(nodeSpecs[j], 'sx');
				if (sx == null || isNaN(sx)) {
					this.onXMLMinorError("unable to parse x component of scaling; discarding transform");
					break;
				}

				let sy = this.reader.getFloat(nodeSpecs[j], 'sy');
				if (sy == null || isNaN(sy)) {
					this.onXMLMinorError("unable to parse y component of scaling; discarding transform");
					break;
				}

				let sz = this.reader.getFloat(nodeSpecs[j], 'sz');
				if (sz == null || isNaN(sz)) {
					this.onXMLMinorError("unable to parse z component of scaling; discarding transform");
					break;
				}
				
				mat4.scale(newNode.transformMatrix, newNode.transformMatrix, [sx, sy, sz]);
				break;
			default:
				break;
		}
	}
	
	// Process Descendants
	let descendantsIndex = specNames.indexOf("DESCENDANTS");
	if (descendantsIndex === -1){
		this.onXMLMinorError("An Intermediate Node must have descendants");
		return null;
	}
	let descendants = nodeSpecs[descendantsIndex].children;
	
	for (let i = 0; i < descendants.length; i++){
		let child = descendants[i];
		if (child.nodeName === "NODEREF"){
			// Process child node
			let nodeID = this.reader.getString(child, 'id');
			let nodeIndexInXMLNodes = this.nodeIDToIndex[nodeID];
			if (nodeIndexInXMLNodes != null && nodeIndexInXMLNodes > -1){
				newNode.addChild(this.parseNode(this.xmlNodes[nodeIndexInXMLNodes]));
			}else{
				this.onXMLMinorError("Descendant id: " + nodeID + " is not declared.");
				return null;
			}
		}else if (child.nodeName === "LEAF"){
			// Process child leaf
			
			newNode.addLeaf(this.processLeaf(child));
		}else{
			this.onXMLMinorError("incorrect descendant node with name: " + child.nodeName);
			return null;
		}
	}
	return newNode;
}


MySceneGraph.prototype.processLeaf = function(leafToParse){
	let type = this.reader.getItem(leafToParse, 'type', ['rectangle', 'cylinder', 'sphere', 'triangle']);
	let argsString = this.reader.getString(leafToParse,'args');
	let argsArray = argsString.split(" ");
	let leafObject = null;
	switch (type) {
        case 'rectangle':
			if (argsArray.length === 4){
				leafObject = new Rectangle(this.scene, argsArray[0],argsArray[1],argsArray[2],argsArray[3]);
			}else{
				console.log("Error parsing rectangle. Invalid number of arguments");
			}
            break;
        case 'cylinder':
            leafObject = new Cylinder(this.scene, 12, 12);
            break;
        case 'sphere':
            leafObject = new Sphere(this.scene);
            break;
        case 'triangle':
			if (argsArray.length === 9){
				leafObject = new Triangle(this.scene,argsArray);
			}else {
				console.log("Error reading triangle, length should be equal to 9");
			}
            break;
    }
	return leafObject;
}
/**
 * Parses the <NODES> block.
 */
MySceneGraph.prototype.parseNodes = function(nodesNode) {

    // Traverses nodes.
    this.xmlNodes = nodesNode.children;

    for (let i = 0; i < this.xmlNodes.length; i++) {
        let nodeName;
        if ((nodeName = this.xmlNodes[i].nodeName) == "ROOT") {
            // Retrieves root node.
            if (this.idRoot != null)
                return "there can only be one root node";
            else {
                let root = this.reader.getString(this.xmlNodes[i], 'id');
                if (root == null)
                    return "failed to retrieve root node ID";
                this.idRoot = root;
            }
        } else if (nodeName == "NODE") {
            // Retrieves node ID.
            let nodeID = this.reader.getString(this.xmlNodes[i], 'id');
            if (nodeID == null){
				return "failed to retrieve node ID";
			}
            // Checks if ID is valid.
            if (this.nodeIDToIndex[nodeID] != null){
				return "node ID must be unique (conflict: ID = " + nodeID + ")";
			}
            this.nodeIDToIndex[nodeID] = i;  
		}
    }
	if (this.nodeIDToIndex[this.idRoot] == null){
		return "Invalid Root ID";
	}
	this.nodeTree = this.parseNode(this.xmlNodes[this.nodeIDToIndex[this.idRoot]]);

    console.log("Parsed nodes");
    return null;
}

/*
 * Callback to be executed on any read error
 */
MySceneGraph.prototype.onXMLError = function(message) {
    console.error("XML Loading Error: " + message);
    this.loadedOk = false;
}

/**
 * Callback to be executed on any minor error, showing a warning on the console.
 */
MySceneGraph.prototype.onXMLMinorError = function(message) {
    console.warn("Warning: " + message);
}

MySceneGraph.prototype.log = function(message) {
    console.log("   " + message);
}

/**
 * Generates a default material, with a random name. This material will be passed onto the root node, which
 * may override it.
 */
MySceneGraph.prototype.generateDefaultMaterial = function() {
    let materialDefault = new CGFappearance(this.scene);
    materialDefault.setShininess(1);
    materialDefault.setSpecular(0, 0, 0, 1);
    materialDefault.setDiffuse(0.5, 0.5, 0.5, 1);
    materialDefault.setAmbient(0, 0, 0, 1);
    materialDefault.setEmission(0, 0, 0, 1);

    // Generates random material ID not currently in use.
    this.defaultMaterialID = null;
    do this.defaultMaterialID = MySceneGraph.generateRandomString(5);
    while (this.materials[this.defaultMaterialID] != null);

    this.materials[this.defaultMaterialID] = materialDefault;
}

/**
 * Generates a random string of the specified length.
 */
MySceneGraph.generateRandomString = function(length) {
    // Generates an array of random integer ASCII codes of the specified length
    // and returns a string of the specified length.
    let numbers = [];
    for (let i = 0; i < length; i++)
        numbers.push(Math.floor(Math.random() * 256)); // Random ASCII code.

    return String.fromCharCode.apply(null, numbers);
}

/**
 * Displays the scene, processing each node, starting in the root node.
 */
MySceneGraph.prototype.displayScene = function() {
    // entry point for graph rendering
    // remove log below to avoid performance issues
    let materialStack = [];
    let textureStack = [];
	if (this.nodeTree != null) {
		this.log("Graph should be rendered here...");
		this.displayNode(this.nodeTree,materialStack,textureStack);
	}

    
}

MySceneGraph.prototype.displayNode = function(nodeToDisplay,materialStack,textureStack) {
    if (nodeToDisplay.leaves.length > 0){
        let materialID = materialStack[materialStack.length -1];
        let material = this.materials[materialID].apply();
        nodeToDisplay.leaves.forEach(leaf => {
            leaf.display();
        });
    }
    if (nodeToDisplay.children.length > 0){
        nodeToDisplay.children.forEach(node => {
            this.scene.pushMatrix();
            this.scene.multMatrix(node.transformMatrix);
            if (node.materialID == "null" && materialStack.length > 0){
                materialStack.push(materialStack[materialStack.length -1]);
            }else{
                materialStack.push(node.materialID);
            }
            if (node.textureID == "null" && textureStack.length > 0){
                textureStack.push(textureStack[textureStack.length -1]);
            }else{
                textureStack.push(node.textureID);
            }
            this.displayNode(
                node,materialStack,textureStack);
                });
        this.scene.popMatrix();
        materialStack.pop();
        textureStack.pop();
    }
    

}
attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

uniform float alpha;
varying vec4 selected_color;

void main() {
    vec4 vertex = uMVMatrix * vec4(aVertexPosition, 1.0);

	vec3 N = normalize(vec3(uNMatrix * vec4(aVertexNormal, 1.0)));

    vec4 outline_vertex = vertex + vec4(N * 0.05, 1.0);
	
	gl_Position = uPMatrix * outline_vertex;

	float ranged_alpha = (alpha + 1.0) / 2.0;
	selected_color = vec4(1.0, 0.0, 0.0, ranged_alpha);
}

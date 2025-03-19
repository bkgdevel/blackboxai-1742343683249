class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    // Add two vectors
    add(v) {
        return new Vector3(
            this.x + v.x,
            this.y + v.y,
            this.z + v.z
        );
    }

    // Subtract vector
    subtract(v) {
        return new Vector3(
            this.x - v.x,
            this.y - v.y,
            this.z - v.z
        );
    }

    // Multiply by scalar
    multiply(scalar) {
        return new Vector3(
            this.x * scalar,
            this.y * scalar,
            this.z * scalar
        );
    }

    // Divide by scalar
    divide(scalar) {
        if (scalar === 0) {
            throw new Error('Division by zero');
        }
        return new Vector3(
            this.x / scalar,
            this.y / scalar,
            this.z / scalar
        );
    }

    // Calculate dot product
    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    // Calculate cross product
    cross(v) {
        return new Vector3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }

    // Get vector length
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    // Get squared length (faster than length)
    lengthSquared() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    // Normalize vector (make length = 1)
    normalize() {
        const length = this.length();
        if (length === 0) {
            return new Vector3();
        }
        return this.divide(length);
    }

    // Distance to another vector
    distanceTo(v) {
        return this.subtract(v).length();
    }

    // Squared distance to another vector (faster than distanceTo)
    distanceToSquared(v) {
        return this.subtract(v).lengthSquared();
    }

    // Clone vector
    clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    // Check equality with another vector
    equals(v) {
        return this.x === v.x && this.y === v.y && this.z === v.z;
    }

    // Convert to array
    toArray() {
        return [this.x, this.y, this.z];
    }

    // Set from array
    fromArray(array) {
        this.x = array[0];
        this.y = array[1];
        this.z = array[2];
        return this;
    }

    // Linear interpolation between two vectors
    lerp(v, alpha) {
        return new Vector3(
            this.x + (v.x - this.x) * alpha,
            this.y + (v.y - this.y) * alpha,
            this.z + (v.z - this.z) * alpha
        );
    }

    // Round vector components to nearest integer
    round() {
        return new Vector3(
            Math.round(this.x),
            Math.round(this.y),
            Math.round(this.z)
        );
    }

    // Floor vector components
    floor() {
        return new Vector3(
            Math.floor(this.x),
            Math.floor(this.y),
            Math.floor(this.z)
        );
    }

    // Ceil vector components
    ceil() {
        return new Vector3(
            Math.ceil(this.x),
            Math.ceil(this.y),
            Math.ceil(this.z)
        );
    }
}

module.exports = { Vector3 };
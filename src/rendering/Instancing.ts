import * as THREE from 'three';

/**
 * InstancedPool — thin wrapper around THREE.InstancedMesh with slot reuse.
 *
 * Use for props that repeat a lot (trees, stones, ambient monsters)
 * per PRD §19.2. Caller manages ids; pool manages slot<->id mapping.
 *
 * Capacity is fixed at construction. If exceeded, acquire() warns and drops
 * (returns -1) rather than throwing — keeps gameplay running during tuning.
 */
export class InstancedPool {
  private readonly _mesh: THREE.InstancedMesh;
  private readonly capacity: number;
  private readonly idToSlot = new Map<number, number>();
  private readonly freeSlots: number[] = [];
  private readonly usesColor: boolean;
  private nextFreshSlot = 0;
  private readonly hiddenMatrix: THREE.Matrix4;

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number) {
    this.capacity = capacity;
    this._mesh = new THREE.InstancedMesh(geometry, material, capacity);
    // Default: instanceColor optional — enable when first colored write happens.
    this.usesColor = false;
    this._mesh.count = 0;
    this._mesh.frustumCulled = false;

    // Matrix used to park released slots off-screen so they don't render weirdly
    // until overwritten by the next acquire().
    this.hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  get mesh(): THREE.InstancedMesh {
    return this._mesh;
  }

  /** Number of currently live instances. */
  get size(): number {
    return this.idToSlot.size;
  }

  /**
   * Reserve a slot for `id` and set its transform.
   * Returns the slot index on success, -1 if capacity exceeded.
   */
  acquire(id: number, matrix: THREE.Matrix4, color?: THREE.ColorRepresentation): number {
    if (this.idToSlot.has(id)) {
      // Already acquired — treat as update.
      return this.update(id, matrix, color);
    }
    let slot: number;
    if (this.freeSlots.length > 0) {
      slot = this.freeSlots.pop()!;
    } else if (this.nextFreshSlot < this.capacity) {
      slot = this.nextFreshSlot++;
    } else {
      console.warn(`[InstancedPool] capacity ${this.capacity} exceeded; dropping id=${id}`);
      return -1;
    }
    this.idToSlot.set(id, slot);
    this._mesh.setMatrixAt(slot, matrix);
    if (color !== undefined) {
      this.ensureColorAttribute();
      this._mesh.setColorAt(slot, new THREE.Color(color));
      if (this._mesh.instanceColor) this._mesh.instanceColor.needsUpdate = true;
    }
    this._mesh.instanceMatrix.needsUpdate = true;
    this._mesh.count = Math.max(this._mesh.count, slot + 1);
    return slot;
  }

  /** Update an existing id's matrix/color. Returns slot or -1 if unknown. */
  update(id: number, matrix: THREE.Matrix4, color?: THREE.ColorRepresentation): number {
    const slot = this.idToSlot.get(id);
    if (slot === undefined) return -1;
    this._mesh.setMatrixAt(slot, matrix);
    this._mesh.instanceMatrix.needsUpdate = true;
    if (color !== undefined) {
      this.ensureColorAttribute();
      this._mesh.setColorAt(slot, new THREE.Color(color));
      if (this._mesh.instanceColor) this._mesh.instanceColor.needsUpdate = true;
    }
    return slot;
  }

  /** Release a slot back to the free-list. No-op if id is unknown. */
  release(id: number): void {
    const slot = this.idToSlot.get(id);
    if (slot === undefined) return;
    this.idToSlot.delete(id);
    this.freeSlots.push(slot);
    // Park hidden so stale transforms don't render until reused.
    this._mesh.setMatrixAt(slot, this.hiddenMatrix);
    this._mesh.instanceMatrix.needsUpdate = true;
  }

  /** Free GPU buffers. */
  dispose(): void {
    this._mesh.dispose();
  }

  private ensureColorAttribute(): void {
    if (this._mesh.instanceColor) return;
    // Allocate per-instance color on first colored write.
    const colors = new Float32Array(this.capacity * 3);
    for (let i = 0; i < this.capacity; i++) {
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
    }
    this._mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    void this.usesColor; // silence unused if caller never colors
  }
}

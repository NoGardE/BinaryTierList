// src/Tree.ts
class Node {
  value: string;
  left: Node | null = null;
  right: Node | null = null;
  parent: Node | null = null;

  constructor(value: string) {
    this.value = value;
  }

  addChild(value: string, direction: 'left' | 'right') {
    this[direction] = new Node(value);
    this[direction]!.parent = this;
  }
}

class Tree {
  root: Node | null = null;
  sizeCount: number = 0; // Track total number of nodes
  alpha: number = 0.75; // Balance factor (0.5 < alpha < 1)

  constructor(value?: string) {
    if (value) {
      this.root = new Node(value);
      this.sizeCount = 1;
    }
  }

  size(node: Node | null): number {
    if (!node) return 0;
    return 1 + this.size(node.left) + this.size(node.right);
  }

  delete(value: string) {
    this.root = this._deleteRecursive(this.root, value);
    if (this.root) this.root.parent = null;
    this.sizeCount = this.size(this.root);
    this.balance();
  }

  _deleteRecursive(node: Node | null, value: string): Node | null {
    if (!node) return null;
    if (value < node.value) {
      node.left = this._deleteRecursive(node.left, value);
      if (node.left) node.left.parent = node;
    } else if (value > node.value) {
      node.right = this._deleteRecursive(node.right, value);
      if (node.right) node.right.parent = node;
    } else {
      if (!node.left) {
        const right = node.right;
        if (right) right.parent = node.parent;
        return right;
      }
      if (!node.right) {
        const left = node.left;
        if (left) left.parent = node.parent;
        return left;
      }
      let successor = this._findMin(node.right);
      node.value = successor.value;
      node.right = this._deleteRecursive(node.right, successor.value);
      if (node.right) node.right.parent = node;
    }
    return node;
  }

  _findMin(node: Node): Node {
    let current = node;
    while (current.left) {
      current = current.left;
    }
    return current;
  }

  balance() {
    console.log('Starting tree balance');
    if (this.root) {
      this.root = this._balanceScapegoat(this.root);
      if (this.root) this.root.parent = null;
    }
    const isBalanced = this._verifyBalance(this.root);
    console.log(`Tree balance completed. Is balanced: ${isBalanced}`);
    if (!isBalanced) {
      console.warn('Tree is not balanced after balance() call. Tree structure:');
      console.warn(this.getTreeString());
    }
  }

  // Balance the tree by checking for a scapegoat and rebuilding if needed
  _balanceScapegoat(node: Node | null): Node | null {
    if (!node) return null;

    // Recursively balance subtrees
    console.log(`Balancing node ${node.value}`);
    node.left = this._balanceScapegoat(node.left);
    if (node.left) node.left.parent = node;
    node.right = this._balanceScapegoat(node.right);
    if (node.right) node.right.parent = node;

    // Check if node is a scapegoat
    const leftSize = this.size(node.left);
    const rightSize = this.size(node.right);
    const totalSize = this.size(node);
    const balanceFactor = Math.abs(leftSize - rightSize);
    console.log(`Node ${node.value}: L:${leftSize}, R:${rightSize}, Balance factor: ${balanceFactor}`);

    if (balanceFactor > 1 && totalSize > 1) {
      console.log(`Node ${node.value} is a scapegoat (balance factor: ${balanceFactor})`);
      // Collect nodes in the subtree
      const nodes: Node[] = [];
      this._collectNodes(node, nodes);
      console.log(`Collected ${nodes.length} nodes for rebuilding subtree rooted at ${node.value}`);

      // Rebuild the subtree into a balanced binary tree
      const newSubtree = this._buildBalancedTree(nodes, 0, nodes.length - 1);
      if (newSubtree) newSubtree.parent = node.parent;
      return newSubtree;
    }

    console.log(`Node ${node.value} is balanced (balance factor: ${balanceFactor})`);
    return node;
  }

  // Collect nodes in-order for rebuilding
  _collectNodes(node: Node | null, nodes: Node[]) {
    if (!node) return;
    this._collectNodes(node.left, nodes);
    nodes.push(new Node(node.value)); // Create new node to avoid pointer issues
    this._collectNodes(node.right, nodes);
  }

  // Build a balanced binary tree from sorted nodes
  _buildBalancedTree(nodes: Node[], start: number, end: number): Node | null {
    if (start > end) return null;
    const mid = Math.floor((start + end) / 2);
    const node = nodes[mid];
    console.log(`Building node ${node.value} (start: ${start}, end: ${end})`);
    node.left = this._buildBalancedTree(nodes, start, mid - 1);
    if (node.left) node.left.parent = node;
    node.right = this._buildBalancedTree(nodes, mid + 1, end);
    if (node.right) node.right.parent = node;
    console.log(`Node ${node.value}: L:${this.size(node.left)}, R:${this.size(node.right)}`);
    return node;
  }

  _verifyBalance(node: Node | null): boolean {
    if (!node) return true;
    const leftSize = this.size(node.left);
    const rightSize = this.size(node.right);
    const balanceFactor = Math.abs(leftSize - rightSize);
    if (balanceFactor > 1) {
      console.warn(`Node ${node.value} is unbalanced: L:${leftSize}, R:${rightSize}, Balance factor: ${balanceFactor}`);
      return false;
    }
    return this._verifyBalance(node.left) && this._verifyBalance(node.right);
  }

  getSorted(): string[] {
    const result: string[] = [];
    this._getSortedRecursive(this.root, result);
    return result;
  }

  _getSortedRecursive(node: Node | null, result: string[]) {
    if (node) {
      this._getSortedRecursive(node.left, result);
      result.push(node.value);
      this._getSortedRecursive(node.right, result);
    }
  }

  getTreeString(): string {
    const lines: string[] = [];
    this._inorderRecursive(this.root, 0, '', lines);
    return lines.join('\n');
  }

  _inorderRecursive(node: Node | null, level: number, prefix: string, lines: string[]) {
    if (node) {
      this._inorderRecursive(node.left, level + 1, '/', lines);
      lines.push('  '.repeat(level) + prefix + `${node.value} (L:${this.size(node.left)}, R:${this.size(node.right)})`);
      this._inorderRecursive(node.right, level + 1, '\\', lines);
    }
  }
}

export { Node, Tree };
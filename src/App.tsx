// App.tsx
import React, { useState } from 'react';
import { Tree, Node } from './Tree';

function App() {
  const [input, setInput] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [tree, setTree] = useState<Tree | null>(null);
  const [randomized, setRandomized] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentItem, setCurrentItem] = useState<string | null>(null);
  const [currentNode, setCurrentNode] = useState<Node | null>(null);
  const [sorted, setSorted] = useState<string[] | null>(null);
  const [boundaries, setBoundaries] = useState<number[]>([]);
  const [tierNames, setTierNames] = useState<string[]>([]);

  const handleSubmit = () => {
    const list = input.split('\n').map(s => s.trim()).filter(s => s);
    setItems(list);
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    setRandomized(shuffled);
    if (shuffled.length === 0) return;
    const newTree = new Tree(shuffled[0]);
    setTree(newTree);
    setCurrentIndex(1);
    if (shuffled.length > 1) {
      setCurrentItem(shuffled[1]);
      setCurrentNode(newTree.root);
    } else {
      setSorted(newTree.getSorted());
    }
  };

  const handleDirection = (direction: 'left' | 'right') => {
  if (!currentNode || !currentItem || !tree) return;
  const child = currentNode[direction];
  if (child) {
    setCurrentNode(child);
  } else {
    currentNode.addChild(currentItem, direction);
    // Balance the entire tree
    tree.balance();
    // Create a new Tree instance to trigger re-render
    const newTree = new Tree();
    newTree.root = tree.root; // Preserve the balanced root
    // Verify balance (for debugging)
    const isBalanced = verifyBalance(newTree);
    if (!isBalanced) {
      console.warn('Tree is not balanced after insertion of', currentItem);
    }
    setTree(newTree);
    const nextIdx = currentIndex + 1;
    if (nextIdx < randomized.length) {
      setCurrentItem(randomized[nextIdx]);
      setCurrentNode(newTree.root); // Use newTree.root
      setCurrentIndex(nextIdx);
    } else {
      setCurrentItem(null);
      setCurrentNode(null);
      setSorted(newTree.getSorted());
    }
  }
};

  // Helper function to verify balance (for debugging)
  const verifyBalance = (tree: Tree): boolean => {
    const checkNode = (node: Node | null): boolean => {
      if (!node) return true;
      const leftSize = tree.size(node.left);
      const rightSize = tree.size(node.right);
      if (Math.abs(leftSize - rightSize) > 1) {
        console.warn(`Node ${node.value} is unbalanced: L:${leftSize}, R:${rightSize}`);
        return false;
      }
      return checkNode(node.left) && checkNode(node.right);
    };
    return checkNode(tree.root);
  };

  const addBoundary = (index: number) => {
    const newBoundaries = [...boundaries, index].sort((a, b) => a - b);
    setBoundaries(newBoundaries);
    setTierNames([...tierNames, '']);
  };

  const removeBoundary = (index: number) => {
    const newBoundaries = boundaries.filter((b) => b !== index);
    setBoundaries(newBoundaries);
    setTierNames(tierNames.filter((_, i) => boundaries[i] !== index));
  };

  const updateTierName = (index: number, name: string) => {
    const newTierNames = [...tierNames];
    newTierNames[index] = name;
    setTierNames(newTierNames);
  };

  const getTiers = () => {
    if (!sorted) return [];
    const tiers: { name: string; items: string[] }[] = [];
    let start = 0;
    boundaries.forEach((boundary, idx) => {
      tiers.push({ name: tierNames[idx], items: sorted.slice(start, boundary) });
      start = boundary;
    });
    tiers.push({ name: tierNames[tierNames.length - 1], items: sorted.slice(start) });
    return tiers;
  };

  return (
    <div style={{ padding: '20px' }}>
      {!items.length ? (
        <div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Enter items, one per line."
            rows={5}
            cols={50}
          />
          <br />
          <button onClick={handleSubmit}>Start</button>
        </div>
      ) : null}
      {currentItem && currentNode ? (
        <div>
          <p>Which is better?</p>
          <button onClick={() => handleDirection('left')}>{currentItem}</button>
          <button onClick={() => handleDirection('right')}>{currentNode.value}</button>
        </div>
      ) : null}
      {tree ? (
        <div>
          <h3>Current Tree:</h3>
          <pre>{tree.getTreeString() || 'Empty'}</pre>
        </div>
      ) : null}{sorted ? (
        <div>
          <h2>Sorted List:</h2>
          <ul>
            {sorted.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
          <h2>Create Tier List</h2>
          <ul>
            {sorted.map((item, idx) => (
              <React.Fragment key={idx}>
                <li>{item}</li>
                {idx < sorted.length - 1 && (
                  <button onClick={() => addBoundary(idx + 1)}>Add Boundary Here</button>
                )}
              </React.Fragment>
            ))}
          </ul>
          <h3>Tier List</h3>
          {getTiers().map((tier, idx) => (
            <div key={idx}>
              <input
                type="text"
                placeholder="Tier Name"
                value={tierNames[idx] || ''}
                onChange={(e) => updateTierName(idx, e.target.value)}
              />
              <ul>
                {tier.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default App;
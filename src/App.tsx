import React, { useState, useRef } from 'react';
import { Tree, Node } from './Tree';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CSSProperties } from 'react'; // Import CSSProperties for typing

const BoundaryType = 'boundary';

function App() {
  const [currentStep, setCurrentStep] = useState<'input' | 'imageUpload' | 'sorting' | 'tierSetting' | 'locked'>('input');
  const [input, setInput] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [itemImages, setItemImages] = useState<{ [key: string]: string }>({}); // Map items to temporary image URLs
  const [tree, setTree] = useState<Tree | null>(null);
  const [randomized, setRandomized] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentItem, setCurrentItem] = useState<string | null>(null);
  const [currentNode, setCurrentNode] = useState<Node | null>(null);
  const [sorted, setSorted] = useState<string[] | null>(null);
  const [boundaries, setBoundaries] = useState<number[]>([]);
  const [tierNames, setTierNames] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);

  const rainbowColors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];

  const handleImageUpload = (item: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file); // Temporary URL for local file
      setItemImages((prev) => ({ ...prev, [item]: imageUrl }));
    }
  };

  const handleSubmit = () => {
    const list = input.split('\n').map(s => s.trim()).filter(s => s);
    setItems(list);
    setCurrentStep('imageUpload');
  };

  const handleStartSorting = () => {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
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
    setCurrentStep('sorting');
  };

  const handleComparison = (better: string) => {
    if (!currentNode || !currentItem || !tree) return;
    const direction = better === currentNode.value ? 'right' : 'left';
    const child = currentNode[direction];
    if (child) {
      setCurrentNode(child);
    } else {
      currentNode.addChild(currentItem, direction);
      tree.balance();
      const newTree = new Tree();
      newTree.root = tree.root;
      setTree(newTree);
      const nextIdx = currentIndex + 1;
      if (nextIdx < randomized.length) {
        setCurrentItem(randomized[nextIdx]);
        setCurrentNode(tree.root);
        setCurrentIndex(nextIdx);
      } else {
        setCurrentItem(null);
        setCurrentNode(null);
        setSorted(newTree.getSorted());
        setCurrentStep('tierSetting'); // Transition to tier-setting after sorting
      }
    }
  };

  const toggleBoundary = (index: number) => {
    if (boundaries.includes(index)) {
      // Remove boundary and allow Gap to reappear
      removeBoundary(index);
    } else if (boundaries.length < 7) {
      addBoundary(index);
    } else {
      console.log('Maximum of 7 tier boundaries reached');
    }
  };

  const addBoundary = (index: number) => {
    const newBoundaries = [...boundaries, index].sort((a, b) => a - b);
    setBoundaries(newBoundaries);
    if (newBoundaries.length > tierNames.length) {
      setTierNames([...tierNames, '']);
    }
  };

  const removeBoundary = (index: number) => {
    const newBoundaries = boundaries.filter((b) => b !== index);
    setBoundaries(newBoundaries);
    // Adjust tierNames to remove the corresponding name if it exists
    setTierNames(tierNames.filter((_, i) => i < boundaries.length - 1 || boundaries.includes(index - 1)));
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
      tiers.push({ name: tierNames[idx] || '', items: sorted.slice(start, boundary) });
      start = boundary;
    });
    tiers.push({ name: tierNames[boundaries.length] || '', items: sorted.slice(start) });
    return tiers;
  };

  const getMaxTierLength = () => {
    return Math.max(...getTiers().map(tier => tier.items.length), 1);
  };

  const handleLock = () => {
    setLocked(true);
    setCurrentStep('locked');
  };

  const moveBoundary = (oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return;
    const newBoundaries = boundaries.filter((b) => b !== oldIndex);
    newBoundaries.push(newIndex);
    newBoundaries.sort((a, b) => a - b);
    setBoundaries(newBoundaries);
  };

  const Gap = ({ index }: { index: number }) => {
    const [{ isOver }, drop] = useDrop({
      accept: BoundaryType,
      drop: (item: { index: number }) => moveBoundary(item.index, index),
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    });

    const ref = useRef<HTMLDivElement>(null);
    drop(ref); // Connect the drop target to the ref

    const style: CSSProperties = {
      height: '5px',
      backgroundColor: isOver ? 'rgba(173, 216, 230, 0.5)' : 'rgba(173, 216, 230, 0.1)',
      cursor: 'pointer',
      display: 'block',
      position: 'relative' as const,
      zIndex: 10,
    };

    console.log(`Rendering Gap at index ${index}, isOver: ${isOver}`);
    return <div ref={ref} style={style} onClick={() => toggleBoundary(index)}></div>;
  };

  const Boundary = ({ index }: { index: number }) => {
    const [{ isDragging }, drag] = useDrag({
      type: BoundaryType,
      item: { index },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    const ref = useRef<HTMLDivElement>(null);
    drag(ref); // Connect the drag source to the ref

    const style: CSSProperties = {
      height: '5px',
      backgroundColor: isDragging ? 'rgba(0, 0, 0, 0.5)' : 'black',
      cursor: 'move',
      display: 'block',
      position: 'relative' as const,
      zIndex: 10,
    };

    console.log(`Rendering Boundary at index ${index}, isDragging: ${isDragging}`);
    return <div ref={ref} style={style} onClick={() => toggleBoundary(index)}></div>;
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ padding: '20px', backgroundColor: '#2F4F2F', color: '#D3D3D3', minHeight: '100vh' }}>
        {currentStep === 'input' && (
          <div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter items, one per line"
              rows={5}
              cols={50}
              style={{ color: '#D3D3D3', backgroundColor: '#3C3F41' }}
            />
            <br />
            <button onClick={handleSubmit} style={{ color: '#D3D3D3', backgroundColor: '#3C3F41' }}>Submit List</button>
          </div>
        )}
        {currentStep === 'imageUpload' && items.length > 0 && (
          <div>
            <h2 style={{ color: '#D3D3D3' }}>Upload Images</h2>
            <p style={{ color: '#D3D3D3', marginBottom: '10px' }}>
              Select a local image file for each item. The preview will be shown during this session only.
            </p>
            {items.map((item, idx) => (
              <div key={idx} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: '10px' }}>{item}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(item, e)}
                  style={{ color: '#D3D3D3', backgroundColor: '#3C3F41', marginRight: '10px' }}
                />
                {itemImages[item] && (
                  <img src={itemImages[item]} alt={`${item} preview`} style={{ width: '50px', height: '50px', objectFit: 'cover', marginLeft: '10px' }} />
                )}
              </div>
            ))}
            <br />
            <button onClick={handleStartSorting} style={{ color: '#D3D3D3', backgroundColor: '#3C3F41' }}>Start Sorting</button>
          </div>
        )}
        {currentStep === 'sorting' && currentNode && currentItem && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100vh' }}>
            <div>
              <h3>Unsorted</h3>
              <ul style={{ color: '#D3D3D3', listStyleType: 'none' }}>
                {randomized.slice(currentIndex + 1).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
              <p style={{ color: '#D3D3D3', marginBottom: '20px' }}>Which is better?</p>
              <div style={{ display: 'flex', gap: '20px' }}>
                <button
                  onClick={() => handleComparison(currentNode.value)}
                  style={{
                    width: '100px',
                    height: '100px',
                    fontWeight: 'bold',
                    textShadow: '1px 1px 0 black, -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black',
                    backgroundColor: itemImages[currentNode.value] ? 'transparent' : '#568b22',
                    backgroundImage: itemImages[currentNode.value] ? `url(${itemImages[currentNode.value]})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    color: '#D3D3D3',
                    fontSize: '20px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                  }}
                >
                  {currentNode.value}
                </button>
                <button
                  onClick={() => handleComparison(currentItem)}
                  style={{
                    width: '100px',
                    height: '100px',
                    fontWeight: 'bold',
                    textShadow: '1px 1px 0 black, -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black',
                    backgroundColor: itemImages[currentItem] ? 'transparent' : '#568b22',
                    backgroundImage: itemImages[currentItem] ? `url(${itemImages[currentItem]})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    color: '#D3D3D3',
                    fontSize: '20px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                  }}
                >
                  {currentItem}
                </button>
              </div>
            </div>
            <div>
              <h3 style={{ color: '#D3D3D3' }}>Sorted</h3>
              <ul style={{ color: '#D3D3D3', listStyleType: 'none' }}>
                {tree?.getSorted().map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {currentStep === 'tierSetting' && sorted && (
          <div>
            <h2 style={{ color: '#D3D3D3' }}>Set Tiers</h2>
            <ul style={{ color: '#D3D3D3', listStyleType: 'none' }}>
              {sorted.map((item, idx) => (
                <li key={idx}>
                  {idx === 0 && (
                    <div>
                      <input
                        type="text"
                        placeholder="Tier Name"
                        value={tierNames[0] || ''}
                        onChange={(e) => updateTierName(0, e.target.value)}
                        style={{ color: '#D3D3D3', backgroundColor: '#3C3F41', marginBottom: '5px' }}
                      />
                    </div>
                  )}
                  {idx > 0 && boundaries.some((boundary) => boundary === idx) && (
                    <div>
                      <input
                        type="text"
                        placeholder="Tier Name"
                        value={tierNames[boundaries.indexOf(idx) + 1] || ''}
                        onChange={(e) => updateTierName(boundaries.indexOf(idx) + 1, e.target.value)}
                        style={{ color: '#D3D3D3', backgroundColor: '#3C3F41', marginBottom: '5px' }}
                      />
                    </div>
                  )}
                  <div>{item}</div>
                  {idx < sorted.length - 1 && (
                    <div>
                      {!boundaries.includes(idx + 1) && <Gap index={idx + 1} />}
                      {boundaries.includes(idx + 1) && <Boundary index={idx + 1} />}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <button onClick={handleLock} style={{ color: '#D3D3D3', backgroundColor: '#3C3F41' }}>Lock in Tiers</button>
          </div>
        )}
        {currentStep === 'locked' && (
          <div>
            <h2 style={{ color: '#D3D3D3' }}>Final Tier List Table</h2>
            <table border={1} style={{ borderCollapse: 'collapse', marginTop: '20px' }}>
              <tbody>
                {getTiers().map((tier, tierIdx) => (
                  <tr key={tierIdx}>
                    <td
                      style={{
                        fontWeight: 'bold',
                        backgroundColor: rainbowColors[tierIdx % rainbowColors.length],
                        color: 'white',
                        textShadow: '1px 1px 0 black, -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black',
                        width: '100px',
                        height: '100px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                      }}
                    >
                      {tier.name}
                    </td>
                    {tier.items.map((item, itemIdx) => (
                      <td
                        key={itemIdx}
                        style={{
                          width: '100px',
                          height: '100px',
                          backgroundColor: itemImages[item] ? 'transparent' : '#568b22',
                          backgroundImage: itemImages[item] ? `url(${itemImages[item]})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          fontWeight: 'bold',
                          textShadow: '1px 1px 0 black, -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black',
                          color: '#D3D3D3',
                          fontSize: '20px',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                        }}
                      >
                        {item}
                      </td>
                    ))}
                    {tier.items.length < getMaxTierLength() && (
                      <td colSpan={getMaxTierLength() - tier.items.length} style={{ width: '100px', height: '100px' }}></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DndProvider>
  );
}

export default App;
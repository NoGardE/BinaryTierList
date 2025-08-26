import React, { useState, useRef, useEffect } from 'react';
import { Tree, Node } from './Tree';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CSSProperties } from 'react';

const BoundaryType = 'boundary';

interface TierListData {
  items: string[];
  images: { [key: string]: string }; // Base64-encoded images
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div style={{ color: '#D3D3D3', textAlign: 'center', fontSize: '24px' }}>Something went wrong. Please try again.</div>;
    }
    return this.props.children;
  }
}

function App() {
  const [currentStep, setCurrentStep] = useState<'input' | 'imageUpload' | 'sorting' | 'tierSetting' | 'locked'>('input');
  const [input, setInput] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [itemImages, setItemImages] = useState<{ [key: string]: string }>({}); // Map items to base64-encoded images
  const [tree, setTree] = useState<Tree | null>(null);
  const [randomized, setRandomized] = useState<string[]>([]); // Persist randomized items in state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentItem, setCurrentItem] = useState<string | null>(null);
  const [currentNode, setCurrentNode] = useState<Node | null>(null);
  const [sorted, setSorted] = useState<string[] | null>(null);
  const [boundaries, setBoundaries] = useState<number[]>([]);
  const [tierNames, setTierNames] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const [columnWidth, setColumnWidth] = useState<number>(100); // Default width in pixels

  const rainbowColors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
  const textMeasureRef = useRef<HTMLDivElement>(null);

  // Measure the width of the longest item name
  useEffect(() => {
    if (items.length > 0 && textMeasureRef.current) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = '16px sans-serif'; // Match the font used in the list
        const widths = items.map((item) => ctx.measureText(item).width);
        const maxWidth = Math.max(...widths) + 20; // Add padding
        setColumnWidth(maxWidth);
      }
    } else {
      setColumnWidth(100); // Fallback width
    }
  }, [items]);

  // Debug table column widths in locked step
  useEffect(() => {
    if (currentStep === 'locked') {
      const maxTierLength = getMaxTierLength();
      console.log(`Locked table: maxTierLength=${maxTierLength}, tableWidth=calc((100vh / 8) * ${maxTierLength + 1})`);
      getTiers().forEach((tier, idx) => {
        console.log(`Tier ${idx}: ${tier.items.length} items, colspan=${maxTierLength - tier.items.length}`);
      });
    }
  }, [currentStep, sorted, boundaries]);

  // Debug state after step changes
  useEffect(() => {
    console.log(`Current Step: ${currentStep}, Items: ${items.length}, ItemImages: ${Object.keys(itemImages).length}, Randomized: ${randomized.length}, Sorted: ${sorted ? sorted.length : 0}`);
  }, [currentStep, items, itemImages, randomized, sorted]);

  const isValidBase64Image = (str: string): boolean => {
    return typeof str === 'string' && str.startsWith('data:image/');
  };

  const resizeAndCropImage = (file: File, targetSize: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Calculate cropping dimensions to make the image square
          const imgWidth = img.width;
          const imgHeight = img.height;
          const size = Math.min(imgWidth, imgHeight);
          const srcX = (imgWidth - size) / 2;
          const srcY = (imgHeight - size) / 2;

          ctx.drawImage(img, srcX, srcY, size, size, 0, 0, targetSize, targetSize);
          resolve(canvas.toDataURL('image/png', 0.8));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      reader.readAsDataURL(file); // Corrected to readAsDataURL
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleImageUpload = async (item: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        console.log(`Uploading image for item: ${item}`);
        const targetSize = Math.round(window.innerHeight / 8); // Pixel size for locked tiles
        const base64 = await resizeAndCropImage(file, targetSize);
        if (isValidBase64Image(base64)) {
          setItemImages((prev) => {
            const newImages = { ...prev, [item]: base64 };
            console.log(`Updated itemImages:`, newImages);
            return newImages;
          });
        } else {
          alert(`Invalid image file for ${item}. Please upload a valid image.`);
        }
      } catch (error) {
        console.error(`Error processing image for ${item}:`, error);
        alert(`Failed to process image for ${item}. Please try again.`);
      }
    }
  };

  const handleRemoveImage = (item: string) => {
    setItemImages((prev) => {
      const newImages = { ...prev };
      delete newImages[item];
      console.log(`Removed image for ${item}, new itemImages:`, newImages);
      return newImages;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          console.log('Loading file...');
          const text = event.target?.result as string;
          console.log('Raw file content:', text); // Debug raw content
          const data = JSON.parse(text) as TierListData;
          if (!Array.isArray(data.items) || !data.items.every((item) => typeof item === 'string')) {
            throw new Error('Invalid items format in file');
          }
          if (!data.items || data.items.length === 0) {
            throw new Error('No items found in file');
          }
          const validImages: { [key: string]: string } = {};
          if (data.images && typeof data.images === 'object') {
            for (const [item, base64] of Object.entries(data.images)) {
              if (isValidBase64Image(base64)) {
                validImages[item] = base64;
              } else {
                console.warn(`Invalid image data for item ${item}. Skipping image.`);
              }
            }
          }
          console.log(`Parsed data: items=${data.items}, validImages=${Object.keys(validImages).length}`);
          setInput(data.items.join('\n'));
          setItems(data.items);
          setItemImages(validImages);
          setCurrentStep('imageUpload');
          if (Object.keys(data.images).length > Object.keys(validImages).length) {
            alert('Some images in the file were invalid and skipped.');
          }
        } catch (error) {
          console.error('Error parsing file:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          alert(`Invalid file format or no items found. Please upload a valid tier list JSON file. Error: ${errorMessage}`);
          setCurrentStep('input'); // Revert to input step on error
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDownload = () => {
    const data: TierListData = {
      items,
      images: itemImages,
    };
    console.log('Downloading tier list:', data);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tierlist.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = () => {
    const list = input.split('\n').map(s => s.trim()).filter(s => s);
    console.log('Submitting items:', list);
    if (list.length === 0) {
      alert('Please enter at least one item.');
      return;
    }
    setItems(list);
    setItemImages({});
    setCurrentStep('imageUpload');
    console.log('State after submit:', { items: list.length, currentStep });
  };

  const handleStartSorting = () => {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    console.log('Starting sorting with items:', shuffled);
    if (shuffled.length === 0) {
      alert('No items to sort. Please add items first.');
      return;
    }
    // Initialize the tree with the first item
    const newTree = new Tree(shuffled[0]);
    // Remove the first item from randomized
    const updatedRandomized = shuffled.slice(1);
    setTree(newTree);
    setRandomized(updatedRandomized);
    setCurrentIndex(0);
    if (updatedRandomized.length > 0) {
      setCurrentItem(updatedRandomized[0]);
      setCurrentNode(newTree.root);
      setCurrentStep('sorting');
    } else {
      // If only one item, sorting is complete
      setSorted(newTree.getSorted());
      setCurrentItem(null);
      setCurrentNode(null);
      setCurrentStep('tierSetting');
    }
  };

  const handleRestart = () => {
    console.log('Restarting with same config');
    setTree(null);
    setRandomized([]);
    setCurrentIndex(0);
    setCurrentItem(null);
    setCurrentNode(null);
    setSorted(null);
    setBoundaries([]);
    setTierNames([]);
    setLocked(false);
    handleStartSorting();
  };

  const handleNewTierList = () => {
    console.log('Starting new tier list');
    setInput('');
    setItems([]);
    setItemImages({});
    setTree(null);
    setRandomized([]);
    setCurrentIndex(0);
    setCurrentItem(null);
    setCurrentNode(null);
    setSorted(null);
    setBoundaries([]);
    setTierNames([]);
    setLocked(false);
    setCurrentStep('input');
  };

  const handleComparison = (better: string) => {
    if (!currentNode || !currentItem || !tree || !randomized.length) {
      console.error('Invalid state in handleComparison:', { currentNode, currentItem, tree, randomized });
      return;
    }
    console.log(`Comparing: ${currentNode.value} vs ${currentItem}, Choosing ${better}, Current Index: ${currentIndex}, Randomized: ${randomized.length}`);

    // Prevent self-comparison
    if (currentItem === currentNode.value) {
      console.log(`Self-comparison detected for ${currentItem}. Skipping to next item or ending.`);
      const updatedRandomized = [...randomized];
      updatedRandomized.splice(currentIndex, 1); // Remove the current item
      setRandomized(updatedRandomized);
      if (updatedRandomized.length > 0) {
        setCurrentItem(updatedRandomized[0]);
        setCurrentIndex(0);
        setCurrentNode(tree.root);
      } else {
        console.log('All items compared, getting sorted list');
        setCurrentItem(null);
        setCurrentNode(null);
        const sortedList = tree.getSorted();
        console.log('Sorted list:', sortedList);
        setSorted(sortedList);
        setCurrentStep('tierSetting');
      }
      return;
    }

    const direction = better === currentNode.value ? 'right' : 'left';
    const child = currentNode[direction];
    if (child) {
      console.log(`Child exists, moving to ${direction} child: ${child.value}`);
      setCurrentNode(child);
      // Move to the next item in randomized, if available
      if (randomized.length > currentIndex + 1) {
        setCurrentItem(randomized[currentIndex + 1]);
        setCurrentIndex(currentIndex + 1); // Increment currentIndex
      } else if (randomized.length > 0) {
        setCurrentItem(randomized[0]);
        setCurrentIndex(0); // Reset to start of randomized
      } else {
        console.log('All items compared, getting sorted list');
        setCurrentItem(null);
        setCurrentNode(null);
        const sortedList = tree.getSorted();
        console.log('Sorted list:', sortedList);
        setSorted(sortedList);
        setCurrentStep('tierSetting');
      }
    } else {
      console.log(`Adding ${currentItem} as ${direction} child of ${currentNode.value}`);
      currentNode.addChild(currentItem, direction);
      tree.balance();
      const newTree = new Tree();
      newTree.root = tree.root;
      setTree(newTree);
      // Remove the current item from randomized
      const updatedRandomized = [...randomized];
      updatedRandomized.splice(currentIndex, 1);
      setRandomized(updatedRandomized);
      console.log(`Updated randomized: ${updatedRandomized.length} items remaining`, updatedRandomized);
      if (updatedRandomized.length > 0) {
        setCurrentItem(updatedRandomized[0]);
        setCurrentNode(newTree.root);
        setCurrentIndex(0); // Reset index for the next iteration
      } else {
        console.log('All items compared, getting sorted list');
        setCurrentItem(null);
        setCurrentNode(null);
        const sortedList = newTree.getSorted();
        console.log('Sorted list:', sortedList);
        setSorted(sortedList);
        setCurrentStep('tierSetting');
      }
    }
  };

  const toggleBoundary = (index: number) => {
    if (boundaries.includes(index)) {
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
    setTierNames(tierNames.filter((_, i) => i < boundaries.length - 1 || boundaries.includes(index - 1)));
  };

  const updateTierName = (index: number, name: string) => {
    const newTierNames = [...tierNames];
    newTierNames[index] = name;
    setTierNames(newTierNames);
  };

  const getTiers = (): { name: string; items: string[] }[] => {
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

  const getMaxTierLength = (): number => {
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
    const [{ isOver, canDrop }, drop] = useDrop({
      accept: BoundaryType,
      drop: (item: { index: number }) => {
        console.log(`Dropped boundary ${item.index} at gap ${index}`);
        moveBoundary(item.index, index);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    });

    const ref = useRef<HTMLDivElement>(null);
    drop(ref);

    const style: CSSProperties = {
      height: '5px',
      backgroundColor: isOver && canDrop ? 'rgba(173, 216, 230, 0.5)' : 'rgba(173, 216, 230, 0.1)',
      cursor: canDrop ? 'pointer' : 'not-allowed',
      display: 'block',
      position: 'relative' as const,
      zIndex: 10,
    };

    console.log(`Rendering Gap at index ${index}, isOver: ${isOver}, canDrop: ${canDrop}`);
    return <div ref={ref} style={style} onClick={() => toggleBoundary(index)} />;
  };

  const Boundary = ({ index }: { index: number }) => {
    const [{ isDragging }, drag, preview] = useDrag({
      type: BoundaryType,
      item: { index },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    const ref = useRef<HTMLDivElement>(null);
    drag(ref);
    preview(ref); // Ensure preview is called to handle drag preview

    const style: CSSProperties = {
      height: '5px',
      backgroundColor: isDragging ? 'rgba(0, 0, 0, 0.5)' : 'black',
      cursor: 'move',
      display: 'block',
      position: 'relative' as const,
      zIndex: 10,
    };

    console.log(`Rendering Boundary at index ${index}, isDragging: ${isDragging}`);
    return <div ref={ref} style={style} onClick={() => toggleBoundary(index)} />;
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ padding: '20px', backgroundColor: '#2F4F2F', color: '#D3D3D3', minHeight: '100vh' }}>
        <style>
          {`
            @media (max-width: 800px) {
              .unsorted-column {
                display: none;
              }
            }
            @media (max-width: 600px) {
              .sorted-column {
                display: none;
              }
            }
            @media (max-width: 600px) {
              .locked-buttons {
                flex-direction: column;
                align-items: center;
              }
              .locked-button {
                width: 100%;
                max-width: 300px;
                margin: '10px 0';
              }
            }
            @media (max-width: 600px) {
              .sorting-buttons {
                flex-direction: column;
                gap: 20px;
              }
              .sorting-button {
                width: 70vw;
                height: 70vw;
                max-width: 300px;
                max-height: 300px;
              }
            }
            table td {
              display: table-cell; /* Ensure table-cell behavior */
              max-width: calc(100vh / 8); /* Prevent content from stretching cell */
              white-space: normal; /* Allow text to wrap */
            }
          `}
        </style>
        <div ref={textMeasureRef} style={{ position: 'absolute', visibility: 'hidden', font: '16px sans-serif' }} />
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
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              style={{ color: '#D3D3D3', backgroundColor: '#3C3F41', marginRight: '10px' }}
            />
            <button onClick={handleDownload} style={{ color: '#D3D3D3', backgroundColor: '#3C3F41', marginRight: '10px' }}>
              Download List
            </button>
            <button onClick={handleSubmit} style={{ color: '#D3D3D3', backgroundColor: '#3C3F41' }}>
              Submit List
            </button>
          </div>
        )}
        {currentStep === 'imageUpload' && (
          <ErrorBoundary>
            <div>
              {items.length > 0 ? (
                <>
                  <h2 style={{ color: '#D3D3D3' }}>Upload Images</h2>
                  <p style={{ color: '#D3D3D3', marginBottom: '10px' }}>
                    Select a local image file for each item or load a saved tier list. Images are stored for this session or in saved files.
                  </p>
                  {items.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', wordBreak: 'break-word' }}>
                      <span style={{ marginRight: '10px', width: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.length > 20 ? `${item.substring(0, 20)}...` : item || 'Unnamed Item'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(item, e)}
                        style={{ color: '#D3D3D3', backgroundColor: '#3C3F41', marginRight: '10px' }}
                      />
                      {itemImages[item] && (
                        <>
                          <img
                            src={itemImages[item]}
                            alt={`${item} preview`}
                            style={{ width: '50px', height: '50px', objectFit: 'cover', marginRight: '10px' }}
                            onError={() => {
                              console.warn(`Failed to load image for ${item}`);
                              handleRemoveImage(item);
                              alert(`Image for ${item} is invalid and has been removed.`);
                            }}
                          />
                          <button
                            onClick={() => handleRemoveImage(item)}
                            style={{ color: '#D3D3D3', backgroundColor: '#3C3F41', marginRight: '10px' }}
                          >
                            Remove Image
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                  <br />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={handleStartSorting}
                      style={{
                        color: '#D3D3D3',
                        backgroundColor: '#568b22',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        padding: '15px 30px',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        width: '70%',
                        maxWidth: '400px',
                      }}
                    >
                      Start Sorting
                    </button>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        style={{ color: '#D3D3D3', backgroundColor: '#3C3F41', fontSize: '14px' }}
                      />
                      <button
                        onClick={handleDownload}
                        style={{ color: '#D3D3D3', backgroundColor: '#3C3F41', fontSize: '14px', padding: '5px 10px' }}
                      >
                        Save Tier List
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <p style={{ color: '#D3D3D3' }}>No items to display. Please upload a valid tier list file or enter items manually.</p>
              )}
            </div>
          </ErrorBoundary>
        )}
        {currentStep === 'sorting' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100vh' }}>
            {currentNode && currentItem && tree ? (
              <>
                <div className="unsorted-column" style={{ width: `${columnWidth}px`, minWidth: '100px' }}>
                  <h3 style={{ color: '#D3D3D3' }}>Unsorted</h3>
                  <ul style={{ color: '#D3D3D3', listStyleType: 'none' }}>
                    {randomized.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
                  <p style={{ color: '#D3D3D3', marginBottom: '20px', fontSize: '24px', fontWeight: 'bold' }}>
                    Which is better?
                  </p>
                  <div className="sorting-buttons" style={{ display: 'flex', gap: '30px' }}>
                    <button
                      className="sorting-button"
                      onClick={() => handleComparison(currentNode.value)}
                      style={{
                        width: 'calc(35vw - 15px)',
                        height: 'calc(35vw - 15px)',
                        maxWidth: '400px',
                        maxHeight: '400px',
                        minWidth: '150px',
                        minHeight: '150px',
                        fontWeight: 'bold',
                        textShadow: '2px 2px 0 black, -2px -2px 0 black, 2px -2px 0 black, -2px 2px 0 black',
                        backgroundColor: itemImages[currentNode.value] ? 'transparent' : '#568b22',
                        backgroundImage: itemImages[currentNode.value] ? `url(${itemImages[currentNode.value]})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        color: '#D3D3D3',
                        fontSize: '24px',
                        border: '2px solid #D3D3D3',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
                      }}
                    >
                      {currentNode.value}
                    </button>
                    <button
                      className="sorting-button"
                      onClick={() => handleComparison(currentItem)}
                      style={{
                        width: 'calc(35vw - 15px)',
                        height: 'calc(35vw - 15px)',
                        maxWidth: '400px',
                        maxHeight: '400px',
                        minWidth: '150px',
                        minHeight: '150px',
                        fontWeight: 'bold',
                        textShadow: '2px 2px 0 black, -2px -2px 0 black, 2px -2px 0 black, -2px 2px 0 black',
                        backgroundColor: itemImages[currentItem] ? 'transparent' : '#568b22',
                        backgroundImage: itemImages[currentItem] ? `url(${itemImages[currentItem]})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        color: '#D3D3D3',
                        fontSize: '24px',
                        border: '2px solid #D3D3D3',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
                      }}
                    >
                      {currentItem}
                    </button>
                  </div>
                </div>
                <div className="sorted-column" style={{ width: `${columnWidth}px`, minWidth: '100px' }}>
                  <h3 style={{ color: '#D3D3D3' }}>Sorted</h3>
                  <ul style={{ color: '#D3D3D3', listStyleType: 'none' }}>
                    {tree?.getSorted().map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div style={{ color: '#D3D3D3', textAlign: 'center', fontSize: '24px' }}>
                Loading comparison...
              </div>
            )}
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
          <>
            <div style={{ overflowX: 'auto', whiteSpace: 'normal', marginTop: '20px', maxWidth: '100%' }}>
              <table
                border={1}
                style={{
                  borderCollapse: 'collapse',
                  margin: '0',
                  width: `calc((100vh / 8) * ${getMaxTierLength() + 1})`,
                  boxSizing: 'border-box',
                  tableLayout: 'fixed', // Ensure consistent cell sizing
                }}
              >
                <tbody>
                  {getTiers().map((tier, tierIdx) => (
                    <tr key={tierIdx}>
                      <td
                        style={{
                          fontWeight: 'bold',
                          backgroundColor: rainbowColors[tierIdx % rainbowColors.length],
                          color: 'white',
                          textShadow: '1px 1px 0 black, -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black',
                          width: 'calc(100vh / 8)',
                          height: 'calc(100vh / 8)',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          padding: '4px',
                          boxSizing: 'border-box',
                        }}
                      >
                        {tier.name}
                      </td>
                      {tier.items.map((item, itemIdx) => (
                        <td
                          key={itemIdx}
                          style={{
                            width: 'calc(100vh / 8)',
                            height: 'calc(100vh / 8)',
                            backgroundColor: itemImages[item] ? 'transparent' : '#568b22',
                            backgroundImage: itemImages[item] ? `url(${itemImages[item]})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            fontWeight: 'bold',
                            textShadow: '1px 1px 0 black, -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black',
                            color: '#D3D3D3',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            padding: '4px',
                            boxSizing: 'border-box',
                            whiteSpace: 'normal', // Allow wrapping at spaces
                            overflowWrap: 'break-word', // Break words only if necessary
                            hyphens: 'auto', // Add hyphens at linguistic breaks if needed
                            lineHeight: '1.2', // Ensure readable line spacing
                            maxWidth: '100%', // Allow full width for wrapping
                          }}
                        >
                          {item}
                        </td>
                      ))}
                      {tier.items.length < getMaxTierLength() && (
                        <td
                          colSpan={getMaxTierLength() - tier.items.length}
                          style={{
                            width: `calc(100vh / 8 * ${getMaxTierLength() - tier.items.length})`,
                            height: 'calc(100vh / 8)',
                            boxSizing: 'border-box',
                          }}
                        ></td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              className="locked-buttons"
              style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '20px' }}
            >
              <button
                className="locked-button"
                onClick={handleRestart}
                style={{
                  color: '#D3D3D3',
                  backgroundColor: '#3C3F41',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  padding: '15px 30px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  width: '35%',
                  maxWidth: '600px',
                }}
              >
                Restart with Same Config
              </button>
              <button
                className="locked-button"
                onClick={handleNewTierList}
                style={{
                  color: '#D3D3D3',
                  backgroundColor: '#3C3F41',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  padding: '15px 30px',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  width: '35%',
                  maxWidth: '600px',
                }}
              >
                New Tier List
              </button>
            </div>
          </>
        )}
      </div>
    </DndProvider>
  );
}

export default App;
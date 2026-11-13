     // JSON dictionary for touch operation pairs
        const touchOperations = [
            {
                pairs: [
                    {
                        name: "Insert",
                    //    background: "url('https://img.icons8.com/ios-filled/50/000000/plus-math.png')",
                        color: "#999",
                        fn: (point) => {
                            let circle = new paper.Path.Circle(point, 20);
                            circle.fillColor = 'blue';
                            addUndoAction({
                                type: 'add',
                                item: circle,
                                undo: () => circle.remove(),
                                redo: () => paper.project.activeLayer.addChild(circle)
                            });
                        }
                    },
                    {
                        name: "Remove",
                    //    background: "url('https://img.icons8.com/ios-filled/50/000000/minus.png')",
                        color: "#999999",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                let item = hit.item;
                                item.remove();
                                addUndoAction({
                                    type: 'remove',
                                    item: item,
                                    parent: item.parent,
                                    index: item.index,
                                    undo: () => item.parent.insertChild(item.index, item),
                                    redo: () => item.remove()
                                });
                            }
                        }
                    },
                    // Updated Select operation in touchOperations
{
    name: "Select",
    color: "#77cc77",
    fn: (point) => {
        let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
        if (hit && hit.item) {
            let item = hit.item;
            if (!item.selected) {
                // Create a clone for animation
                let clone = item.clone();
                clone.selected = false;
                clone.opacity = 0.5;
                let scale = 1;
                let animation = setInterval(() => {
                    scale += 0.1;
                    clone.scale(1.1);
                    clone.opacity -= 0.1;
                    if (scale >= 1.5) {
                        clone.remove();
                        clearInterval(animation);
                    }
                }, 50); // Runs every 50ms for ~250ms animation
                item.selected = true;
            }
        }
    }
},
{
    name: "Deselect",
    color: "#77cc77",
    fn: (point) => {
        const offsetPoint = new paper.Point(point.x, point.y - 50);
        let hit = paper.project.hitTest(offsetPoint, { fill: true, tolerance: 5 });
        if (hit && hit.item) {
                        let item = hit.item;

//if(item.selected)
//{
hit.item.selected = false;
            
            
  // Create a clone for animation
                let clone = item.clone();
                clone.selected = false;
                clone.opacity = 0.5;
                let scale = 1;
                let animation = setInterval(() => {
                    scale += 0.1;
                    clone.scale(1.1);
                    clone.opacity -= 0.1;
                    if (scale >= 1.5) {
                        clone.remove();
                        clearInterval(animation);
                    }
                }, 50);
//}
           
        } else {
            paper.project.deselectAll();
        }
    }
},

                  
                    {
                        name: "ScaleDn",
                        color: "#ffaaff",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                let item = hit.item;
                                let originalMatrix = item.matrix.clone();
                                item.scale(0.833);
                                addUndoAction({
                                    type: 'scale',
                                    item: item,
                                    matrix: originalMatrix,
                                    undo: () => item.matrix = originalMatrix,
                                    redo: () => item.scale(0.833)
                                });
                            }
                        }
                    },
                    {
                        name: "ScaleUp",
                        color: "#ffaaff",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                let item = hit.item;
                                let originalMatrix = item.matrix.clone();
                                item.scale(1.2);
                                addUndoAction({
                                    type: 'scale',
                                    item: item,
                                    matrix: originalMatrix,
                                    undo: () => item.matrix = originalMatrix,
                                    redo: () => item.scale(1.2)
                                });
                            }
                        }
                    },
                    {
                        name: "Rotate CCW",
                        color: "#ccffcc",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                let item = hit.item;
                                let originalMatrix = item.matrix.clone();
                                item.rotate(-15);
                                addUndoAction({
                                    type: 'rotate',
                                    item: item,
                                    matrix: originalMatrix,
                                    undo: () => item.matrix = originalMatrix,
                                    redo: () => item.rotate(45)
                                });
                            }
                        }
                    },
                    {
                        name: "Rotate CW",
                        color: "#ccffcc",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                let item = hit.item;
                                let originalMatrix = item.matrix.clone();
                                item.rotate(15);
                                addUndoAction({
                                    type: 'rotate',
                                    item: item,
                                    matrix: originalMatrix,
                                    undo: () => item.matrix = originalMatrix,
                                    redo: () => item.rotate(45)
                                });
                            }
                        }
                    },
                    {
                        name: "Teleport",
                        color: "#aaffff",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                hit.item.data.teleportStart = point;
                            }
                        }
                    },
                    {
                        name: "Drag",
                        color: "#aaffff",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item && hit.item.data.teleportStart) {
                                let item = hit.item;
                                let originalPosition = item.position.clone();
                                item.position = hit.item.data.teleportStart;
                                addUndoAction({
                                    type: 'position',
                                    item: item,
                                    position: originalPosition,
                                    undo: () => item.position = originalPosition,
                                    redo: () => item.position = hit.item.data.teleportStart
                                });
                            }
                        }
                    },
                
                    {
                        name: "Subtract",
                        color: "#aaaaff",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                let item = hit.item;
                                item.remove();
                                addUndoAction({
                                    type: 'remove',
                                    item: item,
                                    parent: item.parent,
                                    index: item.index,
                                    undo: () => item.parent.insertChild(item.index, item),
                                    redo: () => item.remove()
                                });
                            }
                        }
                    },
                    {
                        name: "Add",
                        color: "#aaaaff",
                        fn: (point) => {
                            let star = new paper.Path.Star(point, 5, 10, 20);
                            star.fillColor = 'purple';
                            addUndoAction({
                                type: 'add',
                                item: star,
                                undo: () => star.remove(),
                                redo: () => paper.project.activeLayer.addChild(star)
                            });
                        }
                    },
                   
                   
                   
                    {
                        name: "Apply",
                        color: "#ffaa77",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                let item = hit.item;
                                let originalColor = item.fillColor ? item.fillColor.clone() : null;
                                item.fillColor = 'red';
                                addUndoAction({
                                    type: 'color',
                                    item: item,
                                    color: originalColor,
                                    undo: () => item.fillColor = originalColor,
                                    redo: () => item.fillColor = 'red'
                                });
                            }
                        }
                    },
                    {
                        name: "Extract",
                        color: "#ffaa77",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                alert(`Color extracted: ${hit.item.fillColor.toCSS()}`);
                            }
                        }
                    },
               
                    {
                        name: "Paste",
                        color: "#77aaff",
                        fn: (point) => {
                            let circle = new paper.Path.Circle(point, 15);
                            circle.fillColor = 'orange';
                            addUndoAction({
                                type: 'add',
                                item: circle,
                                undo: () => circle.remove(),
                                redo: () => paper.project.activeLayer.addChild(circle)
                            });
                        }
                    },
                    
                    {
                        name: "Copy",
                        color: "#77aaff",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                let clone = hit.item.clone();
                                clone.position = point.add(new paper.Point(30, 30));
                                addUndoAction({
                                    type: 'add',
                                    item: clone,
                                    undo: () => clone.remove(),
                                    redo: () => paper.project.activeLayer.addChild(clone)
                                });
                            }
                        }
                    },
                    {
                        name: "Toggle Stroke",
                        color: "#ccffcc",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                let item = hit.item;
                                // Clone the strokeColor to avoid reference issues; null if no stroke
                                let originalStrokeColor = item.strokeColor ? item.strokeColor.clone() : null;
                                let originalStrokeWidth = item.strokeWidth;
                                if (item.strokeColor) {
                                    // Remove stroke
                                    item.strokeColor = null;
                                } else {
                                    // Add default stroke
                                    item.strokeColor = 'black';
                                    item.strokeWidth = 1;
                                }
                                addUndoAction({
                                    type: 'toggleStroke',
                                    item: item,
                                    originalStrokeColor: originalStrokeColor,
                                    originalStrokeWidth: originalStrokeWidth,
                                    undo: () => {
                                        if (originalStrokeColor) {
                                            // Restore original stroke
                                            item.strokeColor = originalStrokeColor;
                                            item.strokeWidth = originalStrokeWidth;
                                        } else {
                                            // Remove stroke
                                            item.strokeColor = null;
                                        }
                                    },
                                    redo: () => {
                                        if (originalStrokeColor) {
                                            // Remove stroke
                                            item.strokeColor = null;
                                        } else {
                                            // Reapply default stroke
                                            item.strokeColor = 'black';
                                            item.strokeWidth = 1;
                                        }
                                    }
                                });
                            }
                        }
                    },
                    {
                        name: "Toggle Fill",
                        color: "#ccffcc",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                let item = hit.item;
                                // Clone the fillColor to avoid reference issues; null if no fill
                                let originalFillColor = item.fillColor ? item.fillColor.clone() : null;
                                if (item.fillColor) {
                                    // Remove fill
                                    item.fillColor = null;
                                } else {
                                    // Add default fill
                                    item.fillColor = 'white';
                                }
                                addUndoAction({
                                    type: 'toggleFill',
                                    item: item,
                                    originalFillColor: originalFillColor,
                                    undo: () => {
                                        // Restore original fill state
                                        item.fillColor = originalFillColor;
                                    },
                                    redo: () => {
                                        if (originalFillColor) {
                                            // Remove fill
                                            item.fillColor = null;
                                        } else {
                                            // Reapply default fill
                                            item.fillColor = 'white';
                                        }
                                    }
                                });
                            }
                        }
                    }
                ]
            },
            {
                pairs: [
                    {
                        name: "Zoom Out",
                        color: "#ccffcc",
                        fn: (point) => {
                            let originalZoom = paper.view.zoom;
                            paper.view.zoom *= 1.2;
                            addUndoAction({
                                type: 'zoom',
                                zoom: originalZoom,
                                undo: () => paper.view.zoom = originalZoom,
                                redo: () => paper.view.zoom = originalZoom * 1.2
                            });
                        }
                    },
                                        {
                                            name: "Zoom In",
                                            color: "#ccffcc",
                                            fn: (point) => {
                                                let originalZoom = paper.view.zoom;
                                                paper.view.zoom *= 1.2;
                                                addUndoAction({
                                                    type: 'zoom',
                                                    zoom: originalZoom,
                                                    undo: () => paper.view.zoom = originalZoom,
                                                    redo: () => paper.view.zoom = originalZoom * 1.2
                                                });
                                            }
                                        },
                    {
                        name: "Open",
                        color: "#cc7777",
                        fn: (point) => {
                            let rect = new paper.Path.Rectangle(point, new paper.Size(50, 50));
                            rect.fillColor = 'green';
                            addUndoAction({
                                type: 'add',
                                item: rect,
                                undo: () => rect.remove(),
                                redo: () => paper.project.activeLayer.addChild(rect)
                            });
                        }
                    },
                    {
                        name: "Close",
                        color: "#cc7777",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                let item = hit.item;
                                item.remove();
                                addUndoAction({
                                    type: 'remove',
                                    item: item,
                                    parent: item.parent,
                                    index: item.index,
                                    undo: () => item.parent.insertChild(item.index, item),
                                    redo: () => item.remove()
                                });
                            }
                        }
                    },
                    {
                        name: "Hide",
                        color: "#ffffaa",
                        fn: () => {
                            let wasVisible = paper.project.activeLayer.visible;
                            paper.project.activeLayer.visible = false;
                            if (wasVisible) {
                                addUndoAction({
                                    type: 'visibility',
                                    layer: paper.project.activeLayer,
                                    visible: true,
                                    undo: () => paper.project.activeLayer.visible = true,
                                    redo: () => paper.project.activeLayer.visible = false
                                });
                            }
                        }
                    },
                    {
                        name: "Show",
                        color: "#ffffaa",
                        fn: () => {
                            let wasVisible = paper.project.activeLayer.visible;
                            paper.project.activeLayer.visible = true;
                            if (!wasVisible) {
                                addUndoAction({
                                    type: 'visibility',
                                    layer: paper.project.activeLayer,
                                    visible: false,
                                    undo: () => paper.project.activeLayer.visible = false,
                                    redo: () => paper.project.activeLayer.visible = true
                                });
                            }
                        }
                    },
                  
                    {
                        name: "Swap",
                        color: "#ccffcc",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item && paper.project.selectedItems.length === 1) {
                                let selected = paper.project.selectedItems[0];
                                let target = hit.item;
                                let selectedPos = selected.position.clone();
                                let targetPos = target.position.clone();
                                selected.position = targetPos;
                                target.position = selectedPos;
                                addUndoAction({
                                    type: 'swap',
                                    item1: selected,
                                    item2: target,
                                    pos1: selectedPos,
                                    pos2: targetPos,
                                    undo: () => {
                                        selected.position = selectedPos;
                                        target.position = targetPos;
                                    },
                                    redo: () => {
                                        selected.position = targetPos;
                                        target.position = selectedPos;
                                    }
                                });
                            }
                        }
                    },
                    {
                        name: "Classify",
                        color: "#ccffcc",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                let item = hit.item;
                                let originalClass = item.data.class;
                                item.data.class = 'classified';
                                addUndoAction({
                                    type: 'classify',
                                    item: item,
                                    class: originalClass,
                                    undo: () => item.data.class = originalClass,
                                    redo: () => item.data.class = 'classified'
                                });
                            }
                        }
                    },
                    {
                        name: "Nest",
                        color: "#ccffcc",
                        fn: (point) => {
                            let group = new paper.Group(paper.project.selectedItems);
                            group.position = point;
                            addUndoAction({
                                type: 'group',
                                group: group,
                                items: group.children.slice(),
                                undo: () => group.ungroup(),
                                redo: () => {
                                    let newGroup = new paper.Group(group.children);
                                    newGroup.position = point;
                                }
                            });
                        }
                    },
                    {
                        name: "Inspect",
                        color: "#ccffcc",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                alert(`Item type: ${hit.item.className}`);
                            }
                        }
                    },
                    {
                        name: "Group",
                        color: "#ccffcc",
                        fn: () => {
                            let group = new paper.Group(paper.project.selectedItems);
                            addUndoAction({
                                type: 'group',
                                group: group,
                                items: group.children.slice(),
                                undo: () => group.ungroup(),
                                redo: () => new paper.Group(group.children)
                            });
                        }
                    },
                    {
                        name: "Ungroup",
                        color: "#ccffcc",
                        fn: () => {
                            let groups = paper.project.selectedItems.filter(item => item.className === 'Group');
                            groups.forEach(group => {
                                let items = group.children.slice();
                                group.ungroup();
                                addUndoAction({
                                    type: 'ungroup',
                                    items: items,
                                    undo: () => new paper.Group(items),
                                    redo: () => items.forEach(item => item.remove())
                                });
                            });
                        }
                    },
                    {
                        name: "Scroll",
                        color: "#ccffcc",
                        fn: (point) => {
                            let originalCenter = paper.view.center.clone();
                            paper.view.center = point;
                            addUndoAction({
                                type: 'scroll',
                                center: originalCenter,
                                undo: () => paper.view.center = originalCenter,
                                redo: () => paper.view.center = point
                            });
                        }
                    },
                    {
                        name: "Lasso",
                        color: "#ccffcc",
                        fn: (point) => {
                            let lasso = new paper.Path();
                            lasso.add(point);
                            lasso.strokeColor = 'black';
                            addUndoAction({
                                type: 'add',
                                item: lasso,
                                undo: () => lasso.remove(),
                                redo: () => paper.project.activeLayer.addChild(lasso)
                            });
                        }
                    },
                    {
                        name: "Circle",
                        color: "#ccffcc",
                        fn: (point) => {
                            let circle = new paper.Path.Circle(point, 20);
                            circle.fillColor = 'pink';
                            addUndoAction({
                                type: 'add',
                                item: circle,
                                undo: () => circle.remove(),
                                redo: () => paper.project.activeLayer.addChild(circle)
                            });
                        }
                    },
                    {
                        name: "Cut",
                        color: "#ccffcc",
                        fn: (point) => {
                            let hit = paper.project.hitTest(point, { fill: true, tolerance: 5 });
                            if (hit && hit.item) {
                                let item = hit.item;
                                item.remove();
                                addUndoAction({
                                    type: 'remove',
                                    item: item,
                                    parent: item.parent,
                                    index: item.index,
                                    undo: () => item.parent.insertChild(item.index, item),
                                    redo: () => item.remove()
                                });
                            }
                        }
                    },
                    {
                        name: "Lock",
                        color: "#ccffcc",
                        fn: () => {
                            let items = paper.project.selectedItems;
                            items.forEach(item => {
                                let wasLocked = item.locked;
                                item.locked = true;
                                addUndoAction({
                                    type: 'lock',
                                    item: item,
                                    locked: wasLocked,
                                    undo: () => item.locked = wasLocked,
                                    redo: () => item.locked = true
                                });
                            });
                        }
                    },
                    {
                        name: "Unlock",
                        color: "#ccffcc",
                        fn: () => {
                            let items = paper.project.selectedItems;
                            items.forEach(item => {
                                let wasLocked = item.locked;
                                item.locked = false;
                                addUndoAction({
                                    type: 'lock',
                                    item: item,
                                    locked: wasLocked,
                                    undo: () => item.locked = wasLocked,
                                    redo: () => item.locked = false
                                });
                            });
                        }
                    }
                ]
            }
        ];
        
   


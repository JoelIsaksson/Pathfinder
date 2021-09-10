canvas = document.getElementById("canvas");
ctx = canvas.getContext("2d");
topText = document.getElementById("topText");


/* --------------------------
 * |       Veiwport         |
 * --------------------------
 */

//The offset relative to the viewport.
canvasOffset = canvas.getBoundingClientRect();
canvasOffsetX = canvasOffset.left;
canvasOffsetY = canvasOffset.top;

function setOffsets(){
    canvasOffset = canvas.getBoundingClientRect();
    canvasOffsetX = canvasOffset.left;
    canvasOffsetY = canvasOffset.top;
}
window.onresize = setOffsets;
window.onscroll = setOffsets;


/* --------------------------
 * |     Pathfinding        |
 * --------------------------
 */

//Pathfinding algortihm functions.
updateMethod = null;
dequeueMethod = null;

allowDiagonalMovementThroughWalls = false;

endReached = false;

function setDiagonalMovementFalse ()
{
    document.querySelectorAll('.diagonal').forEach((element) => {element.classList.remove('active');});
   document.querySelector('#no').classList.add('active');
    allowDiagonalMovementThroughWalls = false;
}

function setDiagonalMovementTrue ()
{
    document.querySelectorAll('.diagonal').forEach((element) => {element.classList.remove('active');});
    document.querySelector('#yes').classList.add('active'); 
    allowDiagonalMovementThroughWalls = true;
}


/* --------------------------
 * |       Editing          |
 * --------------------------
 */

//Text constants
EDITING   = "Editing: ";
START     = "Start";
BLOCK     = "Blocks";
PATH      = "Finding Path";
END       = "End";
FOUNDPATH = "Found Path";

/* --------------------------
 * |         GUI            |
 * --------------------------
 */

startTime = 0;
endTime = 0;
totalDistance = 0;

lineSegments = [];

drawFrequency = 100;
drawFrequencys = [1, 5, 10, 15, 25, 50, 100, 150, 250, 500, 1000];
activeDrawFrequency = 6;
drawTicks  = drawFrequency;

imageWidth = 720;
imageheight = 720;

imageData  = ctx.createImageData(imageWidth, imageheight);

background   = [100,  100, 100, 255];
inQueue      = [35, 154, 205, 255];
popped       = [255, 230, 204, 255];
endPoint     = [153, 255, 153, 255];
startPoint   = [230, 255, 230, 255];
disabledNode = [250, 70, 70, 255];
finalPath    = [250, 10, 242, 255];

//The offset used when editing specific color channels. Not used.
/*red   = 0;
blue  = 1;
green = 2;
alpha = 3;*/

function setPixel(coord, color)
{
    imageData.data.set(color, coord);
}

function increaseDrawFrequency()
{
    if (activeDrawFrequency + 1 < drawFrequencys.length) {
        drawFrequency = drawFrequencys[++activeDrawFrequency];
        document.querySelector("#drawFrequency").textContent = " " + drawFrequency + " ";
    }
}
 
function decreaseDrawFrequency()
{
    if (activeDrawFrequency - 1 >= 0) {
        drawFrequency = drawFrequencys[--activeDrawFrequency];
        document.querySelector("#drawFrequency").textContent = " " + drawFrequency + " ";
        
    }
}

/* --------------------------
 * |        Editing         |
 * --------------------------
 */

editing = true;
tool = "BLOCK"; //Uses BLOCK START END
toolSize = 1;
toolSizes = [1, 5, 10, 15, 20];
activeToolSize = 0;

clickData = new Object();
resetClickData();
//Keeps track of the start or endpoint moving causing a reset.
pathChanged = false;


function changeTool(e)
{
    document.querySelector(".toolText.active").classList.remove("active");
    tool = e.target.textContent.split(' ').join('').toUpperCase();
    document.querySelector("#" + tool).classList.add("active");
    topText.textContent = EDITING + tool;
}

function increaseToolSize()
{
    if (activeToolSize + 1 < toolSizes.length) {
        toolSize = toolSizes[++activeToolSize];
        document.querySelector("#toolSize").textContent = " " + toolSize + " ";
    }
}
 
function decreaseToolSize()
{
    if (activeToolSize - 1 >= 0) {
        toolSize = toolSizes[--activeToolSize];
        document.querySelector("#toolSize").textContent = " " + toolSize + " ";
        
    }
}

document.querySelectorAll(".toolText").forEach((element) => {
    element.onclick = function (e) {changeTool(e)};
});

/* --------------------------
 * |         Cells          | 
 * --------------------------
 */

class Cell 
{
    constructor(x, y)
    {
        this.x = x;
        this.y = y;
        this.color = background;
        this.heuristic = -1;
        this.distance = Infinity;
        this.adjacencyList = [];
        this.isWall = false;
        this.visited = false;
        this.previus = null;

        this.draw = function()
        {
            for(let y = this.y*cellSize; y < (this.y*cellSize  + cellSize); y++)
            {
                for(let x = this.x*cellSize; x < (this.x*cellSize + cellSize); x++)
                {
                    setPixel(coordToImageIndex(x, y), this.color);
                }
            }
        }

        this.setColor = function(newColor)
        {
            this.color = newColor;
            this.draw();
        }
        this.draw();
    }
}

cellSize  = 10;
cellSizes = [1, 5, 10, 15];
activeCellSize = 2;

width = imageWidth/cellSize;
height = imageheight/cellSize;

start = 0;
end = width-1 +(height-1) * width;

cells = [];

makeCells();

heuristicCost = Math.sqrt(2);

setHeuristic();

openCells = [];

cells[end].setColor(endPoint);
setStart();

function setStart()
{
    openCells.unshift(start);
    cells[start].distance = 0;
    cells[start].visited = true;
    cells[start].setColor(startPoint);
}

function makeCells()
{
    console.log(width);
    cells = new Array(width*height);
    for(y = 0; y < height; y++)
    {
        for(x = 0; x < width; x++)
        {
            cells[x + y*width] = new Cell(x, y);
        }
    }
} 

function increaseCellSize()
{
    if (activeCellSize + 1 < cellSizes.length) {
        cellSize = cellSizes[++activeCellSize];
        document.querySelector("#cellSize").textContent = " " + cellSize + " ";
        width = imageWidth/cellSize;
        height = imageheight/cellSize;
        
        makeCells();

        start = 0;
        end = width-1 +(height-1) * width;

        cells[end].setColor(endPoint);

        setHeuristic();
        resetPath();
    }
}

function decreaseCellSize()
{
    if (activeCellSize - 1 >= 0) {
        cellSize = cellSizes[--activeCellSize];
        document.querySelector("#cellSize").textContent = " " + cellSize + " ";
        width = imageWidth/cellSize;
        height = imageheight/cellSize;

        start = 0;
        end = width-1 +(height-1) * width;

        makeCells();

        cells[end].setColor(endPoint);

        setHeuristic();
        resetPath();
    }
}

//TODO, add an option for non diagonals
function makeAdjacencyList()
{

    topList     = [-1, 1, width, width +1, width -1];
    rightList   = [-1, width, -width, width-1, -width-1];
    bottomList  = [-1, 1, -width, -width +1, -width -1];
    leftList    = [1, width, -width, width +1, -width +1];
    corners     = [width +1, width -1, -width+1, -width-1];

    let isCorner = function(element)
    {
        return corners.includes(element);
    }


    for(y = 0; y < height; y++)
    {
        let list = [ -width-1,-width, -width+1,
                     -1, 1, 
                     width-1 , width,  width+1];
        if(y == 0) list = topList.slice();
        else if(y == height-1) list = bottomList.slice();

        for(x = 0; x < width; x++)
        {
            xlist = list.slice()
            if(x == 0) xlist = list.filter(e => leftList.includes(e));
            else if(x == width-1) xlist = list.filter(e => rightList.includes(e));
            let neighbours = []
            
            for (let i = xlist.length - 1; i >= 0; i--) {
                if(!allowDiagonalMovementThroughWalls)
                {
                    if(isCorner(xlist[i]))
                    {
                        if(corners.indexOf(xlist[i]) ==  0 && xlist.includes(width) && xlist.includes(1)) // Bottom right
                        {
                            if(cells[coordToIndex(x, y) + width].isWall && cells[coordToIndex(x, y) + 1].isWall)
                                continue;

                        } else if(corners.indexOf(xlist[i]) == 1 && xlist.includes(width) && xlist.includes(-1)) // Bottom left
                        {
                            if(cells[coordToIndex(x, y) + width].isWall && cells[coordToIndex(x, y) - 1].isWall)
                                continue;
                        } else if (corners.indexOf(xlist[i]) == 2 && xlist.includes(-width) && xlist.includes(1)) // Top right
                        {
                            if(cells[coordToIndex(x, y) - width].isWall && cells[coordToIndex(x, y) + 1].isWall)
                                continue;
                        } else if (corners.indexOf(xlist[i]) == 3 && xlist.includes(-width) && xlist.includes(-1)) // Top left
                        {
                            if(cells[coordToIndex(x, y) - width].isWall && cells[coordToIndex(x, y) - 1].isWall)
                                continue;
                        }
                    }
                }
                neighbours.push((coordToIndex(x,y) + xlist[i]));
            }
            cells[coordToIndex(x,y)].adjacencyList = neighbours;
        }
    }
}

function setHeuristic()
{
    let endX = end % width;
    let endY = (end - endX) / width;
    for (var y = 0; y < height; y++) 
    {
        for(var x = 0; x < width; x++)
        {
            cells[coordToIndex(x,y)].heuristic = distance(x, y, endX, endY);
        }    
    }    
}

function removeNode(coord)
{
    cells[coord].isWall = true;
    cells[coord].setColor(disabledNode);
}
function returnNode(coord)
{
    cells[coord].isWall = false;
    cells[coord].setColor(background);
}

function resetClickData ()
{
    clickData.draging = false;
    clickData.leftClick = false;
    clickData.rightClick = false;
    clickData.x = 0;
    clickData.y = 0;
}

function resetImage()
{
    for (var i = cells.length - 1; i >= 0; i--) {
        if(!cells[i].isWall && i != end && i != start) cells[i].setColor(background);
    }
}

function resetPath () 
{
    resetImage();

    //Empty set
    openCells = [];

    //Reset Distance
    for (var i = cells.length - 1; i >= 0; i--) {
        cells[i].visited = false;
        cells[i].distance = Infinity;
    }
    //Set the start
    setStart();

    endReached = false;

    setHeuristic();

    //Set mode back to editing
    editing = true;
    topText.textContent = EDITING + BLOCK;
    tool = "BLOCK";
}

function basicQueue () 
{
    //Implements dijkstra's algorithm for pathfinding. Going from start to end.

    //Check if the open set if empty, if so no path was found

    if(!openCells.length)
    {
        noPathFound();
        return;   
    }

    //Find the open cell with the smallest distance from the start and swap it into first place.

    smallestCell = openCells[0];

    for (var i = openCells.length - 1; i >= 0; i--) {
        if(cells[openCells[i]].distance < cells[smallestCell].distance) smallestCell = openCells[i];
    }

    if(smallestCell != openCells[0]) 
    {
        openCells[openCells.indexOf(smallestCell)] = openCells[0];
        openCells[0] = smallestCell;
    }


    //Add the cells neighbours
    for (var i = cells[openCells[0]].adjacencyList.length - 1; i >= 0; i--) {
        let newCell = cells[openCells[0]].adjacencyList[i];
        if(!cells[newCell].isWall)
        {
            let newDist = cells[openCells[0]].distance + distance(cells[openCells[0]].x, cells[openCells[0]].y, cells[newCell].x, cells[newCell].y);
            if (!cells[newCell].visited)
            {
                if(newCell == end)
                { 
                    cells[end].previus = openCells[0];
                    dequeueMethod(); 
                    return;
                }
                openCells.push(newCell);
                cells[newCell].visited = true;
                cells[newCell].distance = newDist;
                cells[newCell].setColor(inQueue);
                cells[newCell].previus = openCells[0];

            } else if(cells[newCell].distance > newDist)  // Makes sure the smallest distance is used.
            {
                cells[newCell].distance = newDist;
                cells[newCell].previus = openCells[0];
            }
        } 
    }


    //Remove the current cell from the open set.
    if(openCells[0] != start) cells[openCells[0]].setColor(popped);
    openCells.shift();
}
function basicDequeue() {
    let findingPath = width*height;
    let path = [];
    path.push(end);

    totalDistance = cells[cells[path[0]].previus].distance + distance(cells[path[0]].x, cells[path[0]].y, cells[cells[path[0]].previus].x, cells[cells[path[0]].previus].y);

    checkPoint = end;
    currentPoint = cells[checkPoint].previus;

    //Checks if a line between a and b is interupted.
    let walkable = function (a, b)
    {

        let left  = a.x < b.x ? a : b;
        let right = b.x > a.x ? b : a; 

        let line = (left.y - right.y)/(left.x - right.x);
        let intersept = left.y - left.x * line;
        let xStep = cellSize/10;
        let rayWidth = .2;
        // Checks at a point (x, y) every xStep units along the line between a and b;
        for(let x = left.x + 0.5; x <= right.x; x += xStep)
        {
            let y = line * x + intersept;
            // Takes 4 points around (x, y);
            points = [];
            //above
            points.push({x: x, y: y -rayWidth}); 
            //below
            points.push({x: x, y: y +rayWidth}); 
            //right
            points.push({x: x+rayWidth, y: y}); 
            //left
            points.push({x: x-rayWidth, y: y});

            let cell;

            for(p of points)
            {
                cellX = p.x < 0 ? 0: ~~p.x;
                cellX = cellX >= width ? width-1: cellX;

                cellY = p.y < 0 ? 0: ~~p.y;
                cellY = cellY >= height ? height-1: cellY;

                if(cells[coordToIndex(cellX, cellY)].isWall)
                    return false;    
            }

            
        }
        return true;
    }



    let maxLoops = 1000;
    lineSegments = [];
    lineSegments.push({x: cells[end].x, y: cells[end].y});

    //Creates line segments along the way between cells that are visible to eachother.
    while(cells[currentPoint].previus !== start && maxLoops--)
    {

        if(walkable(cells[checkPoint], cells[cells[currentPoint].previus]))
        {
            cells[currentPoint].setColor([0,0,0,255]);
            cells[cells[currentPoint].previus].setColor([0,0,0,255]);
            currentPoint = cells[currentPoint].previus;
        } else
        {

            lineSegments.push({x: cells[currentPoint].x, y:cells[currentPoint].y});
            checkPoint = currentPoint;
            currentPoint = cells[currentPoint].previus;

        }
    }

    lineSegments.push({x:cells[start].x, y: cells[start].y});

    while(findingPath--)
    {
        path.unshift(cells[path[0]].previus);

        //End the path or add the neighbour closest to the start to the start of the path.
        if(path[0] == start) findingPath = false;
        else 
        {
            cells[path[0]].setColor(finalPath);
        }

    }
    endReached = true;
    endTime = new Date().getTime();
    let totalTime = (endTime - startTime) * 0.001;
    totalTime = Math.round((totalTime + Number.EPSILON) * 100) / 100
    totalDistance = Math.round((totalDistance + Number.EPSILON) * 100) / 100
    topText.textContent = FOUNDPATH + "with Total Distance: " + totalDistance + " in " + totalTime + "s.";
}

dequeueMethod = basicDequeue;
updateMethod = basicQueue;

function aStarQueue()
{
    //Implements A* algorithm for pathfinding. Going from start to end.

    //Check if the open set if empty, if so no path was found

    if(!openCells.length)
    {
        noPathFound();
        return;   
    }

    //Find the open cell with the neighbour that has the smallest distance to the end using a heuristic to guess at the remaining distance.
    //The search should pick the last entry in case of a tie causing the newest entry to be used. This means that A* will behave like a deapth-first avoiding more than one optimal solution.

    smallestCell = openCells[0];

    for (var i = openCells.length - 1; i >= 0; i--) {
        if(cells[openCells[i]].heuristic  <= cells[smallestCell].heuristic) smallestCell = openCells[i];
    }

    if(smallestCell != openCells[0]) 
    {
        openCells[openCells.indexOf(smallestCell)] = openCells[0];
        openCells[0] = smallestCell;
    }


    //Add the cells neighbours
    for (var i = cells[openCells[0]].adjacencyList.length - 1; i >= 0; i--) {
        let newCell = cells[openCells[0]].adjacencyList[i];
        if(!cells[newCell].isWall)
        {
            let newDist = cells[openCells[0]].distance + distance(cells[openCells[0]].x, cells[openCells[0]].y, cells[newCell].x, cells[newCell].y);
            if (!cells[newCell].visited) //Should handle finding the end
            {
                if(newCell == end)
                { 
                    cells[end].previus = openCells[0];
                    dequeueMethod(); 
                    return;
                }
                openCells.push(newCell);
                cells[newCell].visited = true;
                cells[newCell].distance = newDist;
                cells[newCell].heuristic += newDist;
                cells[newCell].setColor(inQueue);
                cells[newCell].previus = openCells[0];
            } else if(cells[newCell].distance > newDist)  // Makes sure the smallest distance is used.
            {
                cells[newCell].heuristic -= cells[newCell].distance;
                cells[newCell].distance = newDist;
                cells[newCell].heuristic += newDist;
                cells[newCell].previus = openCells[0];
            }
        } 
    }


    //Remove the current cell from the open set and put it in the closed.
    if(openCells[0] != start) cells[openCells[0]].setColor(popped);
    openCells.shift();
}


function noPathFound()
{
    topText.textContent = "No Path Found";
    endReached = true;
}

function defaultAlgorithm() 
{
    updateMethod = basicQueue;
    dequeueMethod = basicDequeue;
    document.getElementById("defaultPath").classList.add("active");
    document.getElementById("aStarPath").classList.remove("active");
    resetPath();
} 
function aStarAlgorithm() 
{
    updateMethod = aStarQueue;
    dequeueMethod = basicDequeue;
    document.getElementById("defaultPath").classList.remove("active");
    document.getElementById("aStarPath").classList.add("active");
    resetPath();
} 

canvas.onmousedown = function (e)
{
    if(editing)
    {
        if(e.button == 0)
        {
            clickData.leftClick = 1;
            
        }
        else if(e.button == 2 && !clickData.leftClick)
        {
            e.preventDefault();
            clickData.rightClick = 1;
        }
        clickData.draging = 1;
        clickData.x = e.clientX - canvasOffsetX;
        clickData.y = e.clientY - canvasOffsetY;
        let box = new Object();
        box.x = ~~(clickData.x/cellSize);
        box.y = ~~(clickData.y/cellSize);
        box.width = 1.2*toolSize;
        box.height = 1.2*toolSize;
        clickData.box = box;
    }
}

document.onmousemove = function (e)
{
    if(clickData.draging)
    {
        clickData.x = e.clientX - canvasOffsetX;
        clickData.y = e.clientY - canvasOffsetY;

        clickData.box.x = ~~(clickData.x/cellSize);
        clickData.box.y = ~~(clickData.y/cellSize);

    }
}

document.onmouseup = function (e)
{
    if(editing)
    {
        resetClickData();
    }
}

document.onkeydown = function (e) 
{
    code = e.keyCode;
    if(code == 32)
    {
        editing = !editing;
        if(editing) 
        {
            if(endReached)
            {
                resetPath(); 
                setHeuristic();
            }

            topText.textContent = EDITING + BLOCK;
            changeTool({target: {textContent:"BLOC K"}});
        }
        else
        {
            if(pathChanged)
            {
                pathChanged = false;
                resetPath(); 
                setHeuristic();
                editing = false;       
            }

            makeAdjacencyList();
            startTime = new Date().getTime();
            topText.textContent = PATH;
        }
    }
    if(code == 82)
    {
        resetPath();
        for (var i = cells.length - 1; i >= 0; i--) {
            if(cells[i].isWall)
            {
                cells[i].isWall = false;
                cells[i].setColor(background);
            }
        }
    }
    else if(code == 49 && editing)
    {
        changeTool({target: {textContent:"BLOCK"}});
        topText.textContent = EDITING + BLOCK;
    }
    else if(code == 50 && editing)
    {
        changeTool({target: {textContent:"START"}});
        topText.textContent = EDITING + START;
    }
    else if(code == 51 && editing)
    {
        changeTool({target: {textContent:"END"}});
        topText.textContent = EDITING + END;
    }
}

function distance(x1, y1, x2, y2)
{
    dx = Math.abs(x1 - x2);
    dy = Math.abs(y1 - y2);
    return (dx + dy) + (heuristicCost - 2) * Math.min(dx, dy);
}

function pointInBox(px, py, box){
    let x1 = box.x;
    let x2 = box.x + box.width;
    let y1 = box.y;
    let y2 = box.y + box.height;

    return (px > x1 && px < x2) && (py > y1 && py < y2);
}

function coordToIndex(x, y)
{
    return y * width + x;
}

function coordToImageIndex(x, y)
{
    return y * (imageWidth * 4) + x * 4;
}

function draw()
{
    ctx.putImageData(imageData, 0, 0);

    if(endReached)
    {
        
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.moveTo(lineSegments[0].x* cellSize + cellSize/2, lineSegments[0].y * cellSize + cellSize/2);
        ctx.strokeStyle = "black";

        for (var i = 1; i < lineSegments.length; i++) {
            p = lineSegments[i];
            ctx.lineTo(p.x* cellSize + cellSize/2, p.y * cellSize + cellSize/2);
        }
        
        ctx.stroke();
        

    }
}

function update()
{
    // Deal with editing
    if(editing)
    {
        if(clickData.leftClick || clickData.rightClick)
        {
            let box = clickData.box; //Find a way to limit the search to a reasonable box 

            
            box.x = (box.x < 0) ?  0 : box.x;
            box.y = (box.y < 0) ? 0 : box.y;



            if(tool == "BLOCK") //Disable all cells that are moused over
            {
                for (let y = box.y; y < height && y < box.y + Math.ceil(box.height); y++)
                {
                    for (let x = box.x; x < width && x < box.x + Math.ceil(box.width); x++)
                    {

                        if(pointInBox(x+.5, y+.5, box))
                        {
                            if(clickData.rightClick)
                            {
                                returnNode(coordToIndex(x, y));
                            }
                            else
                            {
                                removeNode(coordToIndex(x, y));
                            }
                        }
                    }
                }
            } else if (tool == "START")
            {
                outerLoop:
                for (let y = box.y; y < height && y < box.y + Math.ceil(box.height); y++)
                {
                    for (let x = box.x; x < width && x < box.x + Math.ceil(box.width); x++)
                    {

                        if(pointInBox(x+.5, y+.5, box))
                        {
                            cells[start].setColor(background);
                            start = coordToIndex(x, y);
                            cells[start].setColor(startPoint);
                            cells[start].distance = 0;
                            cells[start].visited = true;

                            break outerLoop;
                        }
                    }
                }
                
                pathChanged = true;
            } else if (tool == "END")
            {
                outerLoop:
                for (let y = box.y; y < height && y < box.y + Math.ceil(box.height); y++)
                {
                    for (let x = box.x; x < width && x < box.x + Math.ceil(box.width); x++)
                    {

                        if(pointInBox(x+.5, y+.5, box))
                        {
                            cells[end].setColor(background);
                            end = coordToIndex(x, y);
                            cells[end].setColor(endPoint);

                            break outerLoop;
                        }
                    }
                }
                
                pathChanged = true;
            }

        }
    }

    //Execute one step of the pathfinding algorithm while the end has not been reached.
    else if(!endReached) updateMethod();
}
	

function loop(){
    startt = new Date().getTime();
    while(drawTicks--)
        update();
    drawTicks = drawFrequency;
    draw();
        
    
    totalttime = startt - new Date().getTime();
    if(totalttime > 1/60)
        console.log("Took too long! Time: " + totalttime);
    requestAnimationFrame(loop);
}



requestAnimationFrame(loop);
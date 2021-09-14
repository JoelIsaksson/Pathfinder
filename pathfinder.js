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

imageWidth = 768;
imageheight = 768;

imageData  = ctx.createImageData(imageWidth, imageheight);

background   = [100,  100, 100, 255];
inQueue      = [35, 154, 205, 255];
popped       = [255, 230, 204, 255];
endPoint     = [153, 255, 153, 255];
startPoint   = [230, 255, 230, 255];
disabledNode = [250, 70, 70, 255];
finalPath    = [250, 10, 242, 255];


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

        this.setHeuristic = function ()
        {
            let endX = end % width;
            let endY = (end-endX)/width;
            this.heuristic = distance(this.x, this.y, endX, endY);
        }

        this.setColor = function(newColor)
        {
            this.color = newColor;
            this.draw();
        }

        this.reset = function()
        {
            this.distance = Infinity;
            this.visited = false;
        }

    }
}

class QuadCell extends Cell
{
    constructor(x, y, size)
    {
        super(x, y);

        this.size = size;
        this.children = [];
        this.parent = null;
        this.hasChildren = false;
        this.center = {x: x + size/2, y: y + size/2};

        this.reset = function ()
        {
            if(this.hasChildren)
            {
                for(let child of this.children) child.reset();
            }
            this.distance = Infinity;
            this.visited = false;
        }

        this.setColor = function(newColor)
        {

            this.color = newColor;
            this.draw();
        }

        this.resetColor = function()
        {
            if(this.hasChildren)
            {
                for(let child of this.children)
                    child.resetColor();
            }
            else
            {
                if(this.size == 1    && this.containsWall() ||
                  (this.x == end.x   && this.y == end.y)   ||
                  (this.x == start.x && this.y == start.y    ))
                    return;

                this.color = background;
                this.draw();
            }
        }

        this.makeAdjacencyList = function (isChild)
        {

            let cellWidth = width/quadCellTopSize;
            let cellsPerRow = width/quadCellTopSize;
            let list = [ -cellsPerRow-1,-cellsPerRow, -cellsPerRow+1,
                     -1, 1, 
                     cellsPerRow-1 , cellsPerRow,  cellsPerRow+1];
            this.adjacencyList = [];
            let thisIndex = coordToQuadIndex(this.x, this.y, this.size)

            if (this.hasChildren)
            {
                for(let child of this.children)
                {
                    child.makeAdjacencyList(list, 0);
                }
            }
            else
            {
                for(let index of list)
                {
                    let adjacent = [] 

                    switch(index)
                    {
                        case -1:
                            adjacent.push(this.x-this.size, this.y);
                        break;
                        case 1:
                            adjacent.push(this.x + this.size, this.y);
                            break;
                        case -cellWidth -1:
                            adjacent.push(this.x -this.size, this.y-this.size);
                         break;
                        case -cellWidth +1:
                            adjacent.push(this.x + this.size, this.y-this.size);
                            break;
                        case -cellWidth:
                            adjacent.push(this.x, this.y-this.size);
                            break;
                        case cellWidth -1:
                            adjacent.push(this.x-this.size, this.y + this.size);
                            break;
                        case cellWidth +1:
                            adjacent.push(this.x + this.size, this.y + this.size);
                            break;
                        case cellWidth:
                            adjacent.push(this.x, this.y + this.size);  
                            break;
                    }
                    if(adjacent[0] >= 0 && adjacent[0] < width &&  adjacent[1] >= 0 && adjacent[1] < height)
                    {
                        let p = cells[coordToQuadIndex(adjacent[0], adjacent[1])].getCell(adjacent[0], adjacent[1]);
                        while(p.parent != null && p.size < this.size)
                        {
                            p = p.parent;
                        }
                        

                        if(p.hasChildren)
                        {
                            this.adjacencyList.push(p.getAdjecentChildren(index, p));
                            this.adjacencyList = this.adjacencyList.flat();
                        }
                        else
                        {
                            this.adjacencyList.push(p);
                        }
                    }
                }
            }
        }

        this.getAdjecentChildren = function (index, to)
        {
            let adjecentChildren = [];
            let cellWidth = width/quadCellTopSize;

            //find what cells are adjecent

            let adjacent = [];

            switch(index)
            {
                case -1:
                    adjacent.push(1, 3);
                break;
                case 1:
                    adjacent.push(0, 2);
                    break;
                case -cellWidth -1:
                    adjacent.push(3);
                 break;
                case -cellWidth +1:
                    adjacent.push(2);
                    break;
                case -cellWidth:
                    adjacent.push(2, 3);
                    break;
                case cellWidth -1:
                    adjacent.push(1);
                    break;
                case cellWidth +1:
                    adjacent.push(0);
                    break;
                case cellWidth:
                    adjacent.push(0,1);  
                    break;
            }

            //If they have children call recursively

            for(let childIndex of adjacent)
            {
                if(to.children[childIndex].hasChildren)
                {
                    adjecentChildren.push(to.children[childIndex].getAdjecentChildren(index, to.children[childIndex]));
                }
                else
                {
                    adjecentChildren.push(to.children[childIndex]);
                }
            }


            return adjecentChildren.flat();
        }

        this.containsWall = function () {
            for(let y = this.y; y < this.y + this.size; y++)
            {
                for(let x = this.x; x < this.x + this.size; x++)
                {
                    if(walls[coordToIndex(x, y)])
                        return true;
                }
            }
            return false;
        }

        this.hasChild = function (child)
        {
            let returnValue = false;

            if(!this.hasChildren)
            {
                return this == child;
            } else {
                for(let child of this.children)
                {
                    returnValue = returnValue || (child.hasChild);
                }
            }
            return returnValue;
        }

        this.split = function () {
            if(this.size == 1) return;

            let newSize = this.size/2;
            this.hasChildren = true;

            for(let y = 0; y < 2; y++)
            {
                for(let x = 0; x < 2; x++)
                {
                    let newChild = new QuadCell(x*newSize + this.x, y*newSize + this.y, newSize);
                    newChild.parent = this;
                    if(newChild.containsWall()) newChild.split();
                    this.children.push(newChild);                  
                }
            }
        }

        this.unSplit = function ()
        {
            this.children = [];
            this.hasChildren = false;
        }

        this.setHeuristic = function ()
        {
            if(this.hasChildren)
            {
                for(let child of this.children)
                    child.setHeuristic();
            }
            else
            {
                let ending = getQuadEndPoint(end);
                this.heuristic = distance(this.center.x, this.center.y, ending.x, ending.y);
            }
        }

        this.draw = function()
        {
            if(this.hasChildren)
            {
                for(let child of this.children)
                {
                    child.draw();
                }
            }
            else{
                for(let y = this.y*cellSize; y < (this.y*cellSize  + this.size*cellSize); y++)
                {
                    let row = [];
                    for(let x = this.x*cellSize; x < (this.x*cellSize + this.size*cellSize); x++)
                    {
                        row.push(this.color);
                    }

                    setPixel(coordToImageIndex(this.x*cellSize, y), row.flat(),);
                    
                }
            }
        }

        this.drawRect = function () 
        {
            if(this.hasChildren)
            {
                for(let child of this.children)
                {
                    child.drawRect();
                }
            }
            else{
                if(this.size+cellSize > 4)
                {
                    ctx.strokeStyle = "green";
                    ctx.strokeRect(this.x*cellSize, this.y*cellSize, this.size*cellSize, this.size*cellSize);
                }
            }
        }

        this.clearCell = function(x, y)
        {
            if(!this.containsWall())
            {
                this.unSplit();
            }

            if(this.hasChildren)
            {
                let childSize = this.size/2; 
                let childX = ~~((x-this.x)/childSize);
                let childY = ~~((y-this.y)/childSize);
                let childId = 2*childY + childX;

                this.children[childId].clearCell(x, y);


            }
            else
            {
                this.setColor(background);
            }
        }

        this.setWall = function (x, y) 
        {
            if(this.hasChildren)
            {
                let childSize = this.size/2; 
                let childX = ~~((x-this.x)/childSize);
                let childY = ~~((y-this.y)/childSize);
                let childId = 2*childY + childX;

                this.children[childId].setWall(x, y);
            }
            else if(this.size > 1)
            {
                this.setColor(background);
                this.split();
                this.setWall(x, y);
                if(cells[coordToQuadIndex(end.x, end.y)].hasChild(this)) setEnd();
                else if(cells[coordToQuadIndex(start.x, start.y)].hasChild(this)) setStart();
            }
            else
            {
                //console.log("x: " + this.x + "  y: " + this.y + "  ||  size:" + this.size);
                this.setColor(disabledNode);
                if(cells[coordToQuadIndex(end.x, end.y)].hasChild(this))
                {
                    setEnd();  
                } 
                else if(cells[coordToQuadIndex(start.x, start.y)].hasChild(this))
                {
                    setStart();
                }
            }
        }

        this.setStart = function (x, y)
        {
            if(this.hasChildren)
            {
                let childSize = this.size/2; 
                let childX = ~~((x-this.x)/childSize);
                let childY = ~~((y-this.y)/childSize);
                let childId = 2*childY + childX;

                this.children[childId].setStart(x, y);
            }
            else
            {
                this.setColor(startPoint);
                start = {x: this.x, y: this.y};
                openCells = [];
                openCells.push(this);
                this.distance = 0;
                this.visited = true;
            }
        }

        this.setEnd = function (x, y)
        {
            if(this.hasChildren)
            {
                let childSize = this.size/2; 
                let childX = ~~((x-this.x)/childSize);
                let childY = ~~((y-this.y)/childSize);
                let childId = 2*childY + childX;

                this.children[childId].setEnd(x, y);
            }
            else
            {
                this.setColor(endPoint);
                end = {x: this.x, y: this.y};
            }
        }

        this.getEndPoint = function (x, y)
        {
            if(this.hasChildren)
            {
                let childSize = this.size/2; 
                let childX = ~~((x-this.x)/childSize);
                let childY = ~~((y-this.y)/childSize);
                let childId = 2*childY + childX;

                return this.children[childId].getEndPoint(x, y);
            }
            else
            {
                return {x: this.center.x, y: this.center.y};
            }
        }

        this.getCell = function (x, y)
        {
            if(this.hasChildren)
            {
                let childSize = this.size/2; 
                let childX = ~~((x-this.x)/childSize);
                let childY = ~~((y-this.y)/childSize);
                let childId = 2*childY + childX;
        
                return this.children[childId].getCell(x, y);
            }
            else
            {
                return this;
            }
        }
        
    }
}

quadCellTopSize = 8;
quadCellTopSizes = [64, 32, 8, 4];
usingQuadCells = false;

cellSize  = 8;
cellSizes = [1, 4, 8, 16];
activeCellSize = 2;

width = imageWidth/cellSize;
height = imageheight/cellSize;

start = 0;
end = width-1 +(height-1) * width;

cells = [];

walls = new Array(width*height).fill(false);

if (usingQuadCells)
    makeQuadCells();  //Only called if usingQuadCells is initialized as true;
else
    makeCells();
resetImage();

heuristicCost = Math.sqrt(2);

setHeuristic();

openCells = [];

setStart();
setEnd()

function getQuadEndPoint(point)
{
    return cells[coordToQuadIndex(point.x, point.y)].getEndPoint(point.x, point.y);
}

function setStart()
{
    if(usingQuadCells)
    {
        openCells = [];
        cells[coordToQuadIndex(start.x, start.y)].setStart(start.x, start.y);
    }
    else
    {
        openCells.unshift(start);
        cells[start].distance = 0;
        cells[start].visited = true;
        cells[start].setColor(startPoint);
    }
}

function setEnd()
{
    if(usingQuadCells)
    {
        cells[coordToQuadIndex(end.x, end.y)].setEnd(end.x, end.y);

    }
    else
    {
        cells[end].setColor(endPoint);
    }
}

function makeCells()
{
    cells = new Array(width*height);
    for(y = 0; y < height; y++)
    {
        for(x = 0; x < width; x++)
        {
            cells[x + y*width] = new Cell(x, y);
        }
    }
}

function makeQuadCells() 
{
    quadCellWidth = width/quadCellTopSize;
    cells = new Array(quadCellWidth*quadCellWidth);
    for(y = 0; y < quadCellWidth; y++)
    {
        for(x = 0; x < quadCellWidth; x++)
        {
            cells[x + y*quadCellWidth] = new QuadCell(x*quadCellTopSize, y*quadCellTopSize, quadCellTopSize);
        }
    }
}

function increaseCellSize()
{
    if (activeCellSize + 1 < cellSizes.length) {
        cellSize = cellSizes[++activeCellSize];
        quadCellTopSize = quadCellTopSizes[activeCellSize];

        document.querySelector("#cellSize").textContent = " " + cellSize + " ";
        width = imageWidth/cellSize;
        height = imageheight/cellSize;
        
        if (usingQuadCells)
            makeQuadCells();
        else
            makeCells();
        resetWalls();

        start = 0;

        if(usingQuadCells)
        {
            end = {x: width-1, y: height-1};
            cells[coordToQuadIndex(end.x, end.y)].setEnd(end.x, end.y);
        }
        else
        {
            end = width-1 +(height-1) * width;
            cells[end].setColor(endPoint);
        }


        setHeuristic();
        resetPath();
    }
}

function decreaseCellSize()
{
    if (activeCellSize - 1 >= 0) {
        cellSize = cellSizes[--activeCellSize];
        quadCellTopSize = quadCellTopSizes[activeCellSize];
        document.querySelector("#cellSize").textContent = " " + cellSize + " ";
        width = imageWidth/cellSize;
        height = imageheight/cellSize;

        start = 0;

        if (usingQuadCells)
            makeQuadCells();
        else
            makeCells();
        resetWalls();

        if(usingQuadCells)
        {
            end = {x: width-1, y: height-1};
            cells[coordToQuadIndex(end.x, end.y)].setEnd(end.x, end.y);
        }
        else
        {
            end = width-1 +(height-1) * width;
            cells[end].setColor(endPoint);
        }

        setHeuristic();
        resetPath();
    }
}

function makeAdjacencyList()  //Fix so that quadcells check for walls;
{
    let cellsPerRow = usingQuadCells ? width/quadCellTopSize : width;

    topList     = [-1, 1, cellsPerRow, cellsPerRow +1, cellsPerRow -1];
    rightList   = [-1, cellsPerRow, -cellsPerRow, cellsPerRow-1, -cellsPerRow-1];
    bottomList  = [-1, 1, -cellsPerRow, -cellsPerRow +1, -cellsPerRow -1];
    leftList    = [1, cellsPerRow, -cellsPerRow, cellsPerRow +1, -cellsPerRow +1];
    corners     = [cellsPerRow +1, cellsPerRow -1, -cellsPerRow+1, -cellsPerRow-1];

    let isCorner = function(element)
    {
        return corners.includes(element);
    }


    for(y = 0; y < cellsPerRow; y++)
    {
        let list = [ -cellsPerRow-1,-cellsPerRow, -cellsPerRow+1,
                     -1, 1, 
                     cellsPerRow-1 , cellsPerRow,  cellsPerRow+1];
        if(y == 0) list = topList.slice();
        else if(y == cellsPerRow-1) list = bottomList.slice();
        for(x = 0; x < cellsPerRow; x++)
        {
            xlist = list.slice()
            if(x == 0) xlist = list.filter(e => leftList.includes(e));
            else if(x == cellsPerRow-1) xlist = list.filter(e => rightList.includes(e));
            if(usingQuadCells)
            {
                cells[y*cellsPerRow + x].makeAdjacencyList();
            }
            else
            {
                let neighbours = []
                
                for (let i = xlist.length - 1; i >= 0; i--) {
                    
                    
                        if(!allowDiagonalMovementThroughWalls)
                        {
                            if(isCorner(xlist[i]))
                            {
                                if(corners.indexOf(xlist[i]) ==  0 && xlist.includes(cellsPerRow) && xlist.includes(1)) // Bottom right
                                {
                                    if(walls[coordToIndex(x, y) + cellsPerRow] && walls[coordToIndex(x, y) + 1])
                                        continue;

                                } else if(corners.indexOf(xlist[i]) == 1 && xlist.includes(cellsPerRow) && xlist.includes(-1)) // Bottom left
                                {
                                    if(walls[coordToIndex(x, y) + cellsPerRow] && walls[coordToIndex(x, y) - 1])
                                        continue;
                                } else if (corners.indexOf(xlist[i]) == 2 && xlist.includes(-cellsPerRow) && xlist.includes(1)) // Top right
                                {
                                    if(walls[coordToIndex(x, y) - cellsPerRow] && walls[coordToIndex(x, y) + 1])
                                        continue;
                                } else if (corners.indexOf(xlist[i]) == 3 && xlist.includes(-cellsPerRow) && xlist.includes(-1)) // Top left
                                {
                                    if(walls[coordToIndex(x, y) - cellsPerRow] && walls[coordToIndex(x, y) - 1])
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
}

function setHeuristic()
{

    for(cell of cells) cell.setHeuristic();
}

function removeNode(coord)
{
    if(usingQuadCells)
    {
        let x = coord%width;
        let y = (coord - x) / width;
        walls[coord] = true;
        cells[coordToQuadIndex(x, y)].setWall(x, y);
    }
    else
    {
        walls[coord] = true;
        cells[coord].setColor(disabledNode);
    }
}
function returnNode(coord)
{
    if(usingQuadCells)
    {
        let x = coord%width;
        let y = (coord - x) / width;
        walls[coord] = false;
        cells[coordToQuadIndex(x, y)].clearCell(x, y);

        setEnd();
        setStart();
    }
    else
    {
        walls[coord] = false;
        cells[coord].setColor(background); 
    }
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
    if(usingQuadCells)
    {
        for (var i = cells.length - 1; i >= 0; i--) {
            cells[i].resetColor(background);
        }   
    }
    else
    {
        for (var i = cells.length - 1; i >= 0; i--) {
            if(!walls[i] && i != end && i != start) cells[i].setColor(background);
        }
    }

    lineSegments = [];
}

function resetWalls()
{
    walls = new Array(width*height).fill(false);
}

function resetPath () 
{
    resetImage();

    //Empty set
    openCells = [];

    //Reset Distance
    for (var i = cells.length - 1; i >= 0; i--)
        cells[i].reset();
    //Set the start

    setStart();
    setEnd();

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
        if(!walls[newCell])
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
    



    let maxLoops = 1000;
    lineSegments = [];
    lineSegments.push({x: cells[end].x, y: cells[end].y});

    //Creates line segments along the way between cells that are visible to eachother.
    while(cells[currentPoint].previus !== start && maxLoops--)
    {

        if(walkable({x: cells[checkPoint].x + .5, y: cells[checkPoint].y+ .5}, {x: cells[cells[currentPoint].previus].x + .5, y: cells[cells[currentPoint].previus].y+ .5}))
        {
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
        if(!walls[newCell])
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

function quadStarQueue()
{
    //Implements A* algorithm for pathfinding on the quad-tree structure. Going from start to end.

    //Check if the open set if empty, if so no path was found

    if(!openCells.length)
    {
        noPathFound();
        return;   
    }

    //Find the open cell with the neighbour that has the smallest distance to the end using a heuristic to guess at the remaining distance.
    //The search should pick the last entry in case of a tie causing the newest entry to be used. This means that A* will behave like a deapth-first avoiding more than one optimal solution.

    smallestCell = openCells[0];

    for (var i = openCells.length - 1; i >= 1; i--) {
        if(openCells[i].heuristic  <= smallestCell.heuristic) smallestCell = openCells[i];
    }

    if(smallestCell != openCells[0]) 
    {
        openCells[openCells.indexOf(smallestCell)] = openCells[0];
        openCells[0] = smallestCell;
    }


    //Add the cells neighbours
    for (var i = openCells[0].adjacencyList.length - 1; i >= 0; i--) {
        let newCell = openCells[0].adjacencyList[i];
        let newCellCoord = coordToIndex(newCell.x, newCell.y);
        if(!walls[newCellCoord])
        {
            let newDist = openCells[0].distance + distance(openCells[0].center.x, openCells[0].center.y, newCell.center.x, newCell.center.y);
            if (!newCell.visited) 
            {
                if(newCell.x == end.x && newCell.y == end.y)
                { 
                    cells[coordToQuadIndex(end.x, end.y)].getCell(end.x, end.y).previus = openCells[0];
                    dequeueMethod(); 
                    return;
                }
                openCells.push(newCell);
                newCell.visited = true;
                newCell.distance = newDist;
                newCell.heuristic += newDist;
                newCell.setColor(inQueue); //Change to draw line?
                newCell.previus = openCells[0];
            } else if(newCell.distance > newDist)  // Makes sure the smallest distance is used.
            {
                newCell.heuristic -= newCell.distance;
                newCell.distance = newDist;
                newCell.heuristic += newDist;
                newCell.previus = openCells[0];
            }
        } 
    }


    //Remove the current cell from the open set and put it in the closed.
    if(openCells[0].x != start.x && openCells[0].y != start.y) openCells[0].setColor(popped);
    openCells.shift();
}

function quadStarDequeue()
{
    let findingPath = width*height;
    let path = [];
    path.push(cells[coordToQuadIndex(end.x, end.y)].getCell(end.x, end.y));

    totalDistance = path[0].previus.distance + distance(path[0].center.x, path[0].center.y, path[0].previus.center.x, path[0].previus.center.y);

    checkPoint = path[0];
    currentPoint = checkPoint.previus;

    //Checks if a line between a and b is interupted



    let maxLoops = 1000;
    lineSegments = [];
    lineSegments.push({x: path[0].center.x, y: path[0].center.y});

    //Creates line segments along the way between cells that are visible to eachother.
    while(currentPoint.previus.distance !== 0 && maxLoops--)
    {

        if(walkable(checkPoint.center, currentPoint.previus.center))
        {
            currentPoint = currentPoint.previus;
        } else
        {

            lineSegments.push({x: currentPoint.center.x, y:currentPoint.center.y});
            checkPoint = currentPoint;
            currentPoint = currentPoint.previus;

        }
    }

    lineSegments.push(cells[coordToQuadIndex(start.x, start.y)].getEndPoint(start.x, start.y));

    while(findingPath--)
    {
        path.unshift(path[0] .previus);

        //End the path or add the neighbour closest to the start to the start of the path.
        if(path[0].distance == 0) findingPath = false;
        else 
        {
            path[0].setColor(finalPath);
        }

    }
    endReached = true;
    endTime = new Date().getTime();
    let totalTime = (endTime - startTime) * 0.001;
    totalTime = Math.round((totalTime + Number.EPSILON) * 100) / 100
    totalDistance = Math.round((totalDistance + Number.EPSILON) * 100) / 100
    topText.textContent = FOUNDPATH + "with Total Distance: " + totalDistance + " in " + totalTime + "s.";
}

function noPathFound()
{
    topText.textContent = "No Path Found";
    endReached = true;
}

function useCells()
{
    start = 0;
    end = width*height-1;
    usingQuadCells = false;
    makeCells();
    resetPath();
    makeAdjacencyList();

}

function useQuadCells()
{
    start = {x: 0, y: 0};
    end = {x: width-1, y:height -1};
    usingQuadCells = true;

    makeQuadCells();
    for(let cell of cells)
        if(cell.containsWall()) cell.split();
    resetPath();
    setEnd();
    makeAdjacencyList();

}

function defaultAlgorithm() 
{
    updateMethod = basicQueue;
    dequeueMethod = basicDequeue;

    useCells();

    document.getElementById("defaultPath").classList.add("active");
    document.getElementById("aStarPath").classList.remove("active");
    document.getElementById("quadStarPath").classList.remove("active");
    resetPath();
} 
function aStarAlgorithm() 
{
    updateMethod = aStarQueue;
    dequeueMethod = basicDequeue;

    useCells();

    document.getElementById("defaultPath").classList.remove("active");
    document.getElementById("aStarPath").classList.add("active");
    document.getElementById("quadStarPath").classList.remove("active");
    resetPath();
} 


function quadStarAlgorithm()
{
    updateMethod = quadStarQueue;
    dequeueMethod = quadStarDequeue;

    useQuadCells();

    document.getElementById("defaultPath").classList.remove("active");
    document.getElementById("aStarPath").classList.remove("active");
    document.getElementById("quadStarPath").classList.add("active");
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
            if(usingQuadCells)
            {
                setHeuristic();
            }
            startTime = new Date().getTime();
            topText.textContent = PATH;
        }
    }
    if(code == 82)
    {
        for (var i = walls.length - 1; i >= 0; i--) {
            if(walls[i])
            {
                walls[i] = false;
                if(!usingQuadCells)
                    cells[i].setColor(background);
            }
        }
        if(usingQuadCells)
            for (cell of cells)
            {
                cell.clearCell();
            }
        resetPath();
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

walkable = function (a, b)
{
    
    let dx = -(a.x-b.x);
    let dy = -(a.y-b.y);

    let rayLength = Math.sqrt(dx*dx + dy*dy);

    let dxNorm = dx / rayLength;
    let dyNorm = dy / rayLength;

    let xSign = Math.sign(dx);
    let ySign = Math.sign(dy);

    let dirX = Math.abs(1/dxNorm); 
    let dirY = Math.abs(1/dyNorm); 

    let wallX = ~~a.x;
    let wallY = ~~a.y;


    let dxdUnit = xSign < 0 ? (a.x - wallX) * dirX : (wallX + 1 - a.x) * dirX; 
    let dydUnit = ySign < 0 ? (a.y - wallY) * dirY : (wallY + 1 - a.y) * dirY; 
    

    while(dxdUnit <= rayLength || dydUnit <= rayLength)
    {
        if(dxdUnit < dydUnit)
        {
            wallX += xSign;
            dxdUnit += dirX;
        }
        else
        {
            wallY += ySign;
            dydUnit += dirY;
        }

        if(walls[coordToIndex(wallX, wallY)])
            return false;
    }

    return true;
}

function distance(x1, y1, x2, y2)
{
    let dx = Math.abs(x1 - x2);
    let dy = Math.abs(y1 - y2);

    if(usingQuadCells)
    {
        return Math.sqrt(dx*dx + dy*dy);
    }

    
    return (dx + dy) + (heuristicCost - 2) * Math.min(dx, dy);
}

function pointInBox(px, py, box){
    let x1 = box.x;
    let x2 = box.x + box.width;
    let y1 = box.y;
    let y2 = box.y + box.height;

    return (px > x1 && px < x2) && (py > y1 && py < y2);
}

function coordToQuadIndex(x, y)
{
    return (~~(y/(quadCellTopSize))*width/quadCellTopSize + ~~(x/(quadCellTopSize)))
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

    if(usingQuadCells)
    {
        for(cell of cells)
        {
            cell.drawRect();
        }
    }

    if(endReached && lineSegments.length > 0)
    {
        
        ctx.beginPath();
        ctx.lineWidth = 1;
        if(usingQuadCells)
            ctx.moveTo(lineSegments[0].x* cellSize, lineSegments[0].y * cellSize);
        else
            ctx.moveTo(lineSegments[0].x* cellSize + cellSize/2, lineSegments[0].y * cellSize + cellSize/2);
        ctx.strokeStyle = "black";

        for (var i = 1; i < lineSegments.length; i++) {
            p = lineSegments[i];
            if(usingQuadCells)
                ctx.lineTo(p.x* cellSize, p.y * cellSize);
            else
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
            let box = clickData.box; 

            
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
                            if (usingQuadCells)
                            {
                                cells[coordToQuadIndex(start.x, start.y)].clearCell(start.x, start.y);
                                cells[coordToQuadIndex(x, y)].setStart(x, y);
                            }
                            else
                            {
                                cells[start].setColor(background);
                                start = coordToIndex(x, y);
                                cells[start].setColor(startPoint);
                                cells[start].distance = 0;
                                cells[start].visited = true;
                            }

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
                            if (usingQuadCells)
                            {
                                cells[coordToQuadIndex(end.x, end.y)].clearCell(end.x, end.y);
                                cells[coordToQuadIndex(x, y)].setEnd(x, y);
                                
                            }
                            else
                            {
                                cells[end].setColor(background);
                                end = coordToIndex(x, y);
                                cells[end].setColor(endPoint);                          
                            }

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
import "./style.scss";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import { nanoid } from "nanoid";
import randomcolor from "randomcolor";
import { IndexeddbPersistence } from "y-indexeddb";

interface Cursor {
  id: string;
  color: string;
  x: number;
  y: number;
  chat: string;
  nStale: number;
}

type ReplicatedCursor = Pick<Cursor, "id" | "color" | "x" | "y" | "chat">;

class DigitalFingerprintsProvider {
  self_id: string;
  room_id: string;
  doc: Y.Doc;
  websocketProvider: WebsocketProvider;
  // me: Cursor;
  // others: Map<string, Cursor>;
  // replicated_cursors: Y.Map<ReplicatedCursor>;
  // intervalId: number;
  toUpdate: boolean;
  indexeddbProvider: IndexeddbPersistence;

  constructor(wsProvider = "wss://demos.yjs.dev") {
    this.self_id = nanoid();
    this.room_id = `digital-fingerprints-${
      window.location.host + window.location.pathname
    }`;
    this.doc = new Y.Doc();

    this.websocketProvider = new WebsocketProvider(
      wsProvider,
      this.room_id,
      this.doc
    );
    // this.websocketProvider.on("");
    this.indexeddbProvider = new IndexeddbPersistence(
      "digital-fingerprints",
      this.doc
    );
    this.indexeddbProvider.whenSynced.then(() => {
      console.log("loaded data from indexed db");
    });

    this.toUpdate = true;

    console.log(`connecting to ${this.room_id} with id ${this.self_id}`);

    function getCanvas(): HTMLCanvasElement {
      return document.getElementById("fingerprint")! as HTMLCanvasElement;
    }

    const canvas = getCanvas();

    var radiusBlur = document.getElementById("radiusBlur");
    var radTextBlur = document.getElementById("radTextBlur");
    var radiusPoint = document.getElementById("radiusPoint");
    var radTextPoint = document.getElementById("radTextPoint");
    // Variable for touch mobile
    var arr_touches: number[] = [];
    // Default radio brush and blur
    var radius = 100;
    var blur = 10;
    // Variables draw canvas
    var draggin = false;
    var ctx = canvas.getContext("2d")!;
    // const drawActions: string[] = [];
    const drawActions = this.doc.getArray<string>("drawActions");
    let lastDrewActionIdx = -1;
    // Initiating canvas
    ctx.globalCompositeOperation = "color";
    ctx.lineWidth = radius * 2;
    ctx.shadowBlur = blur;
    ctx.strokeStyle = "#1DB8CE";
    ctx.fillStyle = "#1DB8CE";
    ctx.shadowColor = "#1DB8CE";

    function engage(e: any) {
      draggin = true;
      saveCanvas();
      putPoint(e);
    }
    function disengage() {
      if (draggin) {
        draggin = false;
      }
    }

    drawActions.observe(async (event) => {
      // print updates when the data changes
      const actionsToApply = drawActions.toArray().slice(lastDrewActionIdx + 1);
      console.log("in stack ", lastDrewActionIdx, drawActions.toArray());
      for (const action of actionsToApply) {
        console.log("drawing from stack");
        var canvasPic = new Image();
        // canvasPic.src = drawActions.pop()!;
        canvasPic.src = action;
        await canvasPic.decode();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // ctx.beginPath();
        // TODO: this is slightly off for some reason, some lossiness.
        ctx.drawImage(canvasPic, 0, 0);
        lastDrewActionIdx++;
      }
    });

    // on array change, update the canvas
    function saveCanvas() {
      // if want to support redo, need to save index and then reset and pop redos when
      // new action.
      drawActions.push([getCanvas()!.toDataURL()]);
      lastDrewActionIdx++;
    }

    async function undo() {
      if (!drawActions.length) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      var canvasPic = new Image();
      // canvasPic.src = drawActions.pop()!;
      canvasPic.src = drawActions.get(drawActions.length - 1);
      drawActions.delete(drawActions.length - 1);
      // console.log("cleared ", drawActions);
      await canvasPic.decode();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // ctx.beginPath();
      // TODO: this is slightly off for some reason, some lossiness.
      ctx.drawImage(canvasPic, 0, 0);
    }

    function putPoint(e) {
      var offset = findPos(canvas);
      if (draggin) {
        // TODO: fix this to be wherever the canvas is, offset by current location
        const offsetX = e.clientX - offset.x;
        const offsetY = e.clientY - offset.y;
        ctx.beginPath();
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
        ctx.arc(offsetX, offsetY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.moveTo(offsetX, offsetY);
        ctx.closePath();
      }
    }

    // Functions canvas mobile touch
    function handleStart(evt: any) {
      var touches = evt.changedTouches;
      for (var i = 0; i < touches.length; i++) {
        if (isValidTouch(touches[i])) {
          evt.preventDefault();
          ctx.beginPath();
          arr_touches.push(copyTouch(touches[i]));
          ctx.fill();
          ctx.closePath();
        }
      }
    }
    function handleTouchMove(evt) {
      var touches = evt.changedTouches;
      var offset = findPos(canvas);
      for (var i = 0; i < touches.length; i++) {
        if (isValidTouch(touches[i])) {
          evt.preventDefault();
          var idx = ongoingTouchIndexById(touches[i].identifier);
          if (idx >= 0) {
            ctx.lineTo(
              touches[i].clientX - offset.x,
              touches[i].clientY - offset.y
            );
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(
              touches[i].clientX - offset.x,
              touches[i].clientY - offset.y,
              radius,
              0,
              Math.PI * 2
            );
            ctx.fill();
            ctx.moveTo(
              arr_touches[idx].clientX - offset.x,
              arr_touches[idx].clientY - offset.y
            );
            ctx.closePath();
            arr_touches.splice(idx, 1, copyTouch(touches[i]));
          }
        }
      }
    }
    function handleEnd(evt) {
      var touches = evt.changedTouches;
      var offset = findPos(canvas);
      for (var i = 0; i < touches.length; i++) {
        if (isValidTouch(touches[i])) {
          evt.preventDefault();
          var idx = ongoingTouchIndexById(touches[i].identifier);
          if (idx >= 0) {
            ctx.beginPath();
            ctx.moveTo(
              arr_touches[idx].clientX - offset.x,
              arr_touches[idx].clientY - offset.y
            );
            ctx.lineTo(
              touches[i].clientX - offset.x,
              touches[i].clientY - offset.y
            );
            arr_touches.splice(i, 1);
          }
        }
      }
    }
    function handleCancel(evt) {
      evt.preventDefault();
      var touches = evt.changedTouches;
      for (var i = 0; i < touches.length; i++) {
        arr_touches.splice(i, 1);
      }
    }
    function copyTouch(touch: { identifier: any; clientX: any; clientY: any }) {
      return {
        identifier: touch.identifier,
        clientX: touch.clientX,
        clientY: touch.clientY,
      };
    }
    function ongoingTouchIndexById(idToFind) {
      for (var i = 0; i < arr_touches.length; i++) {
        var id = arr_touches[i].identifier;
        if (id == idToFind) {
          return i;
        }
      }
      return -1;
    }
    function isValidTouch(touch) {
      var curleft = 0,
        curtop = 0;
      var offset = 0;
      if (canvas.offsetParent) {
        do {
          curleft += canvas.offsetLeft;
          curtop += canvas.offsetTop;
        } while (touch == canvas.offsetParent);
        offset = {
          x: curleft - document.body.scrollLeft,
          y: curtop - document.body.scrollTop,
        };
      }
      if (
        touch.clientX - offset.x > 0 &&
        touch.clientX - offset.x < parseFloat(canvas.width) &&
        touch.clientY - offset.y > 0 &&
        touch.clientY - offset.y < parseFloat(canvas.height)
      ) {
        return true;
      } else {
        return false;
      }
    }
    function findPos(obj) {
      const rect = obj.getBoundingClientRect();
      return { x: rect.left, y: rect.top };
    }
    // Seting radius blur
    var setRadiusBlur = function (newBlur) {
      ctx.shadowBlur = newBlur;
    };
    var setRadiusPoint = function (newRadiusPoint) {
      ctx.lineWidth = newRadiusPoint * 2;
    };
    // Handling events listeners
    radiusPoint?.addEventListener("input", function () {
      radTextPoint.innerHTML = radiusPoint.value;
      setRadiusPoint(this.value);
    });
    radiusBlur?.addEventListener("input", function () {
      radTextBlur.innerHTML = radiusBlur.value;
      setRadiusBlur(this.value);
    });
    var changeColor = function (newColor) {
      // console.log("New color is: " + newColor);
      ctx.strokeStyle = newColor;
      ctx.fillStyle = newColor;
      ctx.shadowColor = newColor;
    };
    var selectColors = function (e) {
      var selectColor = e.target;
      changeColor(selectColor.value);
    };
    document
      .getElementById("colorPicker")!
      .addEventListener("change", selectColors);

    // saveCanvas.addEventListener("click", saveImage);
    // clearCanvas.addEventListener("click", clearImage);
    canvas.addEventListener("mousedown", engage);
    canvas.addEventListener("mouseup", disengage);
    canvas.addEventListener("mousemove", putPoint);

    // Handling mobile touch events
    canvas.addEventListener("touchstart", handleStart, false);
    canvas.addEventListener("touchend", handleEnd, false);
    canvas.addEventListener("touchcancel", handleCancel, false);
    canvas.addEventListener("touchleave", handleEnd, false);
    canvas.addEventListener("touchmove", handleTouchMove, false);

    document.addEventListener("keydown", async (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        await undo();
        event.preventDefault();
      }
    });

    //   // initialize self
    //   this.me = {
    //     id: this.self_id,
    //     color: randomcolor({
    //       luminosity: "light",
    //     }),
    //     x: 0,
    //     y: 0,
    //     chat: "",
    //     nStale: 0,
    //     pc: undefined,
    //   };

    //   this.replicated_cursors = this.doc.getMap("state");
    //   this.replicated_cursors.clear();
    //   this.others = new Map();

    //   // attach mouse listener to update self object
    //   document.onmousemove = (evt) => {
    //     if (this.me.x !== evt.pageX && this.me.y !== evt.pageY) {
    //       this.toUpdate = true;
    //       this.me.x = evt.pageX;
    //       this.me.y = evt.pageY;
    //     }
    //     chat.style.setProperty(
    //       "transform",
    //       `translate(${evt.pageX}px, ${evt.pageY}px)`
    //     );
    //   };

    //   // setup replication
    //   this.intervalId = setInterval(() => {
    //     if (this.toUpdate) {
    //       this.replicated_cursors.set(this.self_id, this.me);
    //       this.toUpdate = false;
    //     }

    //     this.others.forEach((concrete) => {
    //       if (concrete.nStale >= 40) {
    //         const el = getCursorElement(concrete);
    //         el?.classList.add("expiring");
    //         if (concrete.nStale >= 60) {
    //           el?.remove();
    //           concrete.pc?.dispose();
    //           this.others.delete(concrete.id);
    //         }
    //       }
    //       concrete.nStale++;
    //     });
    //   }, 80);

    //   // setup key handlers
    //   document.addEventListener("keydown", (event) => {
    //     if (event.key === "/" && chat.value === "") {
    //       event.preventDefault();
    //       if (chat.style.getPropertyValue("display") === "block") {
    //         // empty, most likely toggle intent
    //         chat.style.setProperty("display", "none");
    //       } else {
    //         chat.style.setProperty("display", "block");
    //         chat.focus();
    //       }
    //     }
    //     if (event.key === "Escape") {
    //       event.preventDefault();
    //       chat.value = "";
    //       chat.style.setProperty("display", "none");
    //     }
    //     if (event.key === "Enter") {
    //       event.preventDefault();
    //     }
    //   });

    //   document.addEventListener("keyup", () => {
    //     this.me.chat = chat.value;
    //     this.toUpdate = true;
    //   });

    //   // poll
    //   this.replicated_cursors.observe((evt) => {
    //     const cursorsChanged = Array.from(evt.keysChanged)
    //       .map((cursorId) => this.replicated_cursors.get(cursorId))
    //       .filter((cursorId) => cursorId !== undefined) as ReplicatedCursor[];

    //     cursorsChanged.forEach((cursor: ReplicatedCursor) => {
    //       if (cursor.id !== this.self_id) {
    //         if (this.others.has(cursor.id)) {
    //           // in cache, update
    //           const concrete = this.others.get(cursor.id) as Cursor;
    //           const el = getCursorElement(concrete);
    //           const chatEl = getChatElement(concrete);

    //           if (concrete.chat !== cursor.chat && chatEl) {
    //             if (cursor.chat === "") {
    //               chatEl.classList.remove("show");
    //             } else {
    //               chatEl.classList.add("show");
    //             }
    //             chatEl.innerText = cursor.chat;
    //           }

    //           // increment stale-ness
    //           concrete.nStale = 0;
    //           el?.classList.remove("stale");
    //           el?.classList.remove("expiring");

    //           concrete.pc?.addPoint([cursor.x, cursor.y]);
    //           const updatedConcrete = {
    //             ...concrete,
    //             ...cursor,
    //             pc: concrete.pc,
    //           };
    //           el?.classList.remove("new");
    //           this.others.set(cursor.id, updatedConcrete);
    //         } else {
    //           // new cursor, register and add to dom
    //           const concrete = initializeCursor(cursor, this.cursorLayerDiv);
    //           this.others.set(cursor.id, concrete);
    //         }
    //       }
    //     });
    //   });
  }

  clearLocalHistory() {
    this.indexeddbProvider.clearData();
  }
}

new DigitalFingerprintsProvider();

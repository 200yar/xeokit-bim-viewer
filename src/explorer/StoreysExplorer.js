import {Controller} from "../Controller.js";
import {TreeViewPlugin} from "@xeokit/xeokit-sdk/src/plugins/TreeViewPlugin/TreeViewPlugin.js";
import {TreeViewContextMenu} from "../contextMenus/TreeViewContextMenu.js";
import {math} from "@xeokit/xeokit-sdk/src/viewer/scene/math/math.js";

const tempVec3 = math.vec3();

/** @private */
class StoreysExplorer extends Controller {

    constructor(parent, cfg = {}) {

        super(parent);

        if (!cfg.storeysTabElement) {
            throw "Missing config: storeysTabElement";
        }

        if (!cfg.showAllStoreysButtonElement) {
            throw "Missing config: showAllStoreysButtonElement";
        }

        if (!cfg.hideAllStoreysButtonElement) {
            throw "Missing config: hideAllStoreysButtonElement";
        }

        if (!cfg.storeysElement) {
            throw "Missing config: storeysElement";
        }

        this._storeysTabElement = cfg.storeysTabElement;
        this._showAllStoreysButtonElement = cfg.showAllStoreysButtonElement;
        this._hideAllStoreysButtonElement = cfg.hideAllStoreysButtonElement;
        this._storeysTabButtonElement = this._storeysTabElement.querySelector(".xeokit-tab-btn");

        if (!this._storeysTabButtonElement) {
            throw "Missing DOM element: .xeokit-tab-btn";
        }

        const storeysElement = cfg.storeysElement;

        this._treeView = new TreeViewPlugin(this.viewer, {
            containerElement: storeysElement,
            autoAddModels: false,
            hierarchy: "storeys",
            autoExpandDepth: 1
        });

        this._treeViewContextMenu = new TreeViewContextMenu();

        this._treeView.on("contextmenu", (e) => {
            this._treeViewContextMenu.context = {
                viewer: e.viewer,
                treeViewPlugin: e.treeViewPlugin,
                treeViewNode: e.treeViewNode,
                pruneEmptyNodes: true
            };
            this._treeViewContextMenu.show(e.event.pageX, e.event.pageY);
        });

        // Left-clicking on a tree node isolates that object in the 3D view

        this._treeView.on("nodeTitleClicked", (e) => {
            const objectIds = [];
            e.treeViewPlugin.withNodeTree(e.treeViewNode, (treeViewNode) => {
                if (treeViewNode.objectId) {
                    objectIds.push(treeViewNode.objectId);
                }
            });
            this._selectObjects(objectIds, () => {
            });
        });

        this._onModelLoaded = this.viewer.scene.on("modelLoaded", (modelId) =>{
            const modelInfo = this.bimViewer._modelsExplorer.getModelInfo(modelId);
            if (!modelInfo) {
                return;
            }
            this._treeView.addModel(modelId, {
                rootName: modelInfo.name
            });
        });

        this._onModelUnloaded = this.viewer.scene.on("modelUnloaded", (modelId) => {
            if (this.viewer.metaScene.metaModels[modelId]) {
                this._treeView.removeModel(modelId);
            }
        });

        this.bimViewer.on("reset", () => {
            this._treeView.collapse();
            this._treeView.expandToDepth(1);
        });
    }

    setEnabled(enabled) {
        if (!enabled) {
            this._storeysTabButtonElement.classList.add("disabled");
            this._showAllStoreysButtonElement.classList.add("disabled");
            this._hideAllStoreysButtonElement.classList.add("disabled");
        } else {
            this._storeysTabButtonElement.classList.remove("disabled");
            this._showAllStoreysButtonElement.classList.remove("disabled");
            this._hideAllStoreysButtonElement.classList.remove("disabled");
        }
    }

    expandTreeViewToDepth(depth) {
        this._treeView.expandToDepth(depth);
    }

    showNodeInTreeView(objectId) {
        this._treeView.collapse();
        this._treeView.showNode(objectId);
    }

    unShowNodeInTreeView() {
        this._treeView.unShowNode();
    }

    // selectStorey(storeyObjectId, done) {
    //     const metaScene = this.viewer.metaScene;
    //     const storeyMetaObject = metaScene.metaObjects[storeyObjectId];
    //     if (!storeyMetaObject) {
    //         this.error("flyToStorey() - object is not found: '" + storeyObjectId + "'");
    //         return;
    //     }
    //     const scene = this.viewer.scene;
    //     const objectIds = storeyMetaObject.getObjectIDsInSubtree();
    //     scene.setObjectsSelected(scene.selectedObjectIds, false);
    //     if (done) {
    //         scene.setObjectsVisible(scene.objectIds, true);
    //         scene.setObjectsXRayed(scene.objectIds, true);
    //         scene.setObjectsXRayed(objectIds, false);
    //         this.viewer.cameraFlight.flyTo({
    //             aabb: scene.getAABB(objectIds)
    //         }, () => {
    //             setTimeout(function () {
    //                 scene.setObjectsVisible(scene.xrayedObjectIds, false);
    //                 scene.setObjectsXRayed(scene.xrayedObjectIds, false);
    //             }, 500);
    //             done();
    //         });
    //     } else {
    //         scene.setObjectsVisible(scene.objectIds, false);
    //         scene.setObjectsXRayed(scene.xrayedObjectIds, false);
    //         scene.setObjectsVisible(objectIds, true);
    //         this.viewer.cameraFlight.jumpTo({
    //             aabb: scene.getAABB(objectIds)
    //         });
    //     }
    // }

    selectStorey(storeyObjectId, done) {
        const metaScene = this.viewer.metaScene;
        const storeyMetaObject = metaScene.metaObjects[storeyObjectId];
        if (!storeyMetaObject) {
            this.error("selectStorey() - object is not found: '" + storeyObjectId + "'");
            return;
        }
        if (storeyMetaObject.type !== "IfcBuildingStorey") {
            this.error("selectStorey() - object is not found: '" + storeyObjectId + "'");
            return;
        }
        const objectIds = storeyMetaObject.getObjectIDsInSubtree();
        this._selectObjects(objectIds, done);
    }

    _selectObjects(objectIds, done) {
        const scene = this.viewer.scene;
        // scene.setObjectsVisible(scene.visibleObjectIds, false);
        // scene.setObjectsSelected(scene.selectedObjectIds, false);
        // scene.setObjectsXRayed(scene.xrayedObjectIds, false);


        const aabb = scene.getAABB(objectIds);

        this.viewer.cameraControl.pivotPos = math.getAABB3Center(aabb, tempVec3);

        if (done) {

            scene.setObjectsXRayed(scene.objectIds, true);
            scene.setObjectsVisible(scene.objectIds, true);
            scene.setObjectsPickable(scene.objectIds, false);
            scene.setObjectsSelected(scene.selectedObjectIds, false);

            scene.setObjectsXRayed(objectIds, false);
            scene.setObjectsVisible(objectIds, true);
            scene.setObjectsPickable(objectIds, true);

            this.viewer.cameraFlight.flyTo({
                aabb: aabb
            }, () => {
                setTimeout(function () {
                    scene.setObjectsVisible(scene.xrayedObjectIds, false);
                    scene.setObjectsXRayed(scene.xrayedObjectIds, false);
                }, 500);
                done();
            });
        } else {

            scene.setObjectsVisible(scene.objectIds, false);
            scene.setObjectsPickable(scene.xrayedObjectIds, true);
            scene.setObjectsXRayed(scene.xrayedObjectIds, false);
            scene.setObjectsSelected(scene.selectedObjectIds, false);

            scene.setObjectsVisible(objectIds, true);

            this.viewer.cameraFlight.jumpTo({
                aabb: aabb
            });
        }
    }

    destroy() {
        super.destroy();
        this._treeView.destroy();
        this._treeViewContextMenu.destroy();
        this.viewer.scene.off(this._onModelLoaded);
        this.viewer.scene.off(this._onModelUnloaded);
    }
}

export {StoreysExplorer};
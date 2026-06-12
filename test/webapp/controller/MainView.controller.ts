import Controller from "sap/ui/core/mvc/Controller";
import Sorter from "sap/ui/model/Sorter";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import UI5Event from "sap/ui/base/Event";
import UIComponent from "sap/ui/core/UIComponent";
import JSONModel from "sap/ui/model/json/JSONModel";
import List from "sap/m/List";
import GridList from "sap/f/GridList";
import ListBinding from "sap/ui/model/ListBinding";
import Panel from "sap/m/Panel";
import SearchField from "sap/m/SearchField";
import Button from "sap/m/Button";
import ActionSheet from "sap/m/ActionSheet";

/**
 * @namespace test.controller
 */

function getCustomerId(oView: any): string {
    const oUserModel = oView.getModel("currentUser");
    if (!oUserModel) return "";

    const oUserObj = oUserModel.getProperty("/id");
    console.log(oUserObj);

    console.log("👤 Extracted User Object:", oUserObj);


    return oUserObj.id;
}

export default class MainView extends Controller {
    public onInit(): void {
        console.log("MAINVIEW ENTER");
        const oModel = this.getOwnerComponent()!.getModel();
        const oView = this.getView();

        setTimeout(() => {
            const oOperation = (oModel as any).bindContext("/getMyRoles(...)");
            oView!.setBusy(true);

            oOperation.execute().then(async () => {
                const oUserObj = oOperation.getBoundContext().getValue() as any;
                const oUserModel = new JSONModel({ id: oUserObj });
                this.getView()!.setModel(oUserModel, "currentUser");
                await this.syncListAndCart();
                this._updateDot();
                this.fillInPictruresForMainView();
                oView!.setBusy(false);
            }).catch((oError: any) => {
                console.log("Browsing as guest:", oError);
                oView!.setBusy(false);
            });
        }, 500);

        this.getView()!.addEventDelegate({
            onBeforeShow: async () => {
                const oUserModel = this.getView()!.getModel("currentUser");
                if (oUserModel) {
                    await this.syncListAndCart();
                }
                this._updateDot();
            }
        });

        const oRouter = UIComponent.getRouterFor(this);
        oRouter.getRoute("RouteCustomerDashboard")!.attachPatternMatched(this._onRouteMatched, this);

        const oViewModel = new JSONModel({
            activeFilterId: "",
            activeParentId: ""
        });
        this.getView()?.setModel(oViewModel, "localState");
    }

    private _onRouteMatched(oEvent: UI5Event): void {
        console.log("matched route");
        this._updateDot();
    }

    public onCategoryExpand(oEvent: any): void {
        const oPanel = oEvent.getSource() as Panel;
        if (!oPanel) return;
        const bExpanded = oPanel.getExpanded();
        if (!bExpanded) return;
        const oBindingContext = oPanel.getBindingContext();
        if (!oBindingContext) return;
        const sMainCategoryId = oBindingContext.getProperty("ID");
        const oGridList = this.getView()?.byId("productGrid") as GridList;
        const oProductBinding = oGridList?.getBinding("items") as any;
        if (oProductBinding) {
            oProductBinding.filter([new Filter("mainCategory_ID", FilterOperator.EQ, sMainCategoryId)]);
        }
    }

    public onSubCategorySelect(oEvent: UI5Event): void {
        const oSubList = oEvent.getSource() as List;
        const oSelectedContext = oSubList.getSelectedContexts()[0];
        if (!oSelectedContext) return;
        const sSubCategoryId = oSelectedContext.getProperty("ID");
        const sSubCategoryName = oSelectedContext.getProperty("name");
        const oParentContext = oSubList.getBindingContext();
        const sParentMainId = oParentContext ? oParentContext.getProperty("ID") : "";
        const oViewModel = this.getView()?.getModel("localState") as JSONModel;
        if (oViewModel) {
            oViewModel.setProperty("/activeFilterId", sSubCategoryId);
            oViewModel.setProperty("/activeParentId", sParentMainId);
        }
        const oGridList = this.getView()?.byId("productGrid") as GridList;
        const oProductBinding = oGridList?.getBinding("items") as ListBinding;
        if (oProductBinding) {
            oProductBinding.filter([new Filter("subCategory_ID", FilterOperator.EQ, sSubCategoryId)]);
        }
    }

    public onClearAllFilters(): void {
        const oView = this.getView();
        if (!oView) return;
        const oSearchField = oView.byId("productSearchField") as SearchField;
        if (oSearchField) oSearchField.setValue("");
        const oViewModel = oView.getModel("localState") as JSONModel;
        if (oViewModel) {
            oViewModel.setProperty("/activeFilterId", "");
            oViewModel.setProperty("/activeParentId", "");
        }
        const oGridList = oView.byId("productGrid") as GridList;
        const oProductBinding = oGridList?.getBinding("items") as ListBinding;
        if (oProductBinding) {
            oProductBinding.filter([]);
            oProductBinding.sort([]);
        }
        const oMasterList = this.byId("accordionCategoryList") as List;
        if (oMasterList) {
            oMasterList.getItems().forEach((oItem: any) => {
                const oPanel = oItem.getContent?.().find((oCtrl: any) => oCtrl.isA("sap.m.Panel"));
                if (oPanel && oPanel.getExpanded()) oPanel.setExpanded(false);
                const oSubList = oPanel?.getContent().find((oCtrl: any) => oCtrl.isA("sap.m.List")) as List;
                if (oSubList) oSubList.removeSelections(true);
            });
        }
    }

    public onPriceSortPress(oEvent: any): void {
        const oSourceButton = oEvent.getSource() as Button;
        const oView = this.getView();
        if (!oView) return;
        const oActionSheet = new ActionSheet({
            title: "Sort Products by Price",
            placement: "Bottom",
            buttons: [
                new Button({
                    text: "Price: Low to High",
                    icon: "sap-icon://sort-ascending",
                    press: () => this._applyPriceSorter(false, oSourceButton)
                }),
                new Button({
                    text: "Price: High to Low",
                    icon: "sap-icon://sort-descending",
                    press: () => this._applyPriceSorter(true, oSourceButton)
                })
            ]
        });
        oView.addDependent(oActionSheet);
        oActionSheet.openBy(oSourceButton);
    }

    private _applyPriceSorter(bDescending: boolean, oButton: Button): void {
        if (oButton) {
            oButton.setType("Emphasized");
            oButton.setIcon(bDescending ? "sap-icon://sort-descending" : "sap-icon://sort-ascending");
            oButton.setText(bDescending ? "Price: High-Low" : "Price: Low-High");
        }
        const oGridList = this.byId("productGrid") as GridList;
        if (!oGridList) return;
        const oProductBinding = oGridList.getBinding("items") as ListBinding;
        if (oProductBinding) {
            oProductBinding.sort([new Sorter("price", bDescending)]);
        }
    }

    public async getCart(): Promise<any[]> {
        const oModel = (this.getView()! as any).getModel();
        const oListBinding = (oModel as any).bindList("/Orders", undefined, undefined, undefined, { "$expand": "items" });
        oListBinding.filter(new Filter("IsActiveEntity", FilterOperator.EQ, false));
        try {
            const aDraftContexts = await oListBinding.requestContexts();
            if (aDraftContexts.length > 0) {
                const oDraftOrderData = aDraftContexts[0].getObject() as any;
                return oDraftOrderData.items || [];
            }
            return [];
        } catch (oError) {
            console.error("getCart failed:", oError);
            return [];
        }
    }

    private _updateDot() {
        const oCartQuantityLabel = this.byId("cartQuantityLabel") as any;
        this.getCart().then((aItems) => {
            const iSum = aItems.reduce((acc: number, item: any) => acc + item.quantity, 0);
            if (iSum > 0) {
                oCartQuantityLabel.setText(String(iSum));
                oCartQuantityLabel.setVisible(true);
            } else {
                oCartQuantityLabel.setVisible(false);
            }
        });
    }

    public async syncListAndCart(): Promise<void> {
        const [items, aWishlistItems] = await Promise.all([this.getCart(), this.getWishlist()]);
        const oGridList = this.byId("productGrid") as any;
        if (!oGridList) return;
        const fnProcessUI = () => {
            const aVisualCards = oGridList.getItems();
            aVisualCards.forEach((oCard: any) => {
                const oBindingContext = oCard.getBindingContext();
                if (!oBindingContext) return;
                const oProductObject = oBindingContext.getObject();
                const oMatchingCartItem = items.find((item: any) => item.product_ID === oProductObject.ID);
                const oMainVBox = oCard.getContent()[1];
                const oContent = oMainVBox.getItems()[4];
                const oActionsVBox = oContent.getItems();
                if (oActionsVBox) {
                    const oButton = oActionsVBox[0];
                    const oStepInput = oActionsVBox[1];
                    if (oMatchingCartItem) {
                        oButton.setVisible(false);
                        oStepInput.setVisible(true);
                        oStepInput.setValue(oMatchingCartItem.quantity);
                    } else {
                        oButton.setVisible(true);
                        oButton.setEnabled(oProductObject.stock > 0);
                        oStepInput.setVisible(false);
                    }
                }
                const oHeaderRowVBox = oCard.getContent()[0];
                const oLikeButton = oHeaderRowVBox.getItems()[0];
                if (oLikeButton) {
                    const bIsFavorited = aWishlistItems.some((item: any) => item.product_ID === oProductObject.ID);
                    if (bIsFavorited) {
                        oLikeButton.addStyleClass("wishlist-active");
                        oLikeButton.setType("Reject");
                    } else {
                        oLikeButton.removeStyleClass("wishlist-active");
                    }
                }
            });
        };
        const oBinding = oGridList.getBinding("items");
        if (oBinding && oGridList.getItems().length === 0) {
            oBinding.attachEventOnce("dataReceived", () => setTimeout(() => fnProcessUI(), 50));
        } else {
            fnProcessUI();
        }
    }

    public onProductPress(oEvent: any): void {
        const oBindingContext = oEvent.getSource().getBindingContext();
        const sProductId = oBindingContext.getProperty("ID");
        const oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("RouteProductObjectPage", { productId: sProductId });
    }

    private fillInPictruresForMainView(): void {
        const grid = this.byId("productGrid") as any;
        const oView = this.getView();
        const oModel = oView?.getModel() as any;
        const sServiceUrl = oModel.getServiceUrl();
        if (!grid) return;
        const oCards = grid.getItems();
        for (const oCard of oCards) {
            const oContent = oCard.getContent();
            const oImage = oContent[1].getItems()[0];
            const oBindingContext = oCard.getBindingContext();
            if (!oBindingContext) continue;
            const oProductData = oBindingContext.getObject() as any;
            if (oImage) {
                if (oProductData?.images?.length > 0) {
                    const sProductPath = oBindingContext.getPath().substring(1);
                    const sFirstImageId = oProductData.images[0].ID;
                    const absolutePath = sServiceUrl + sProductPath + `/images(${sFirstImageId})/content`;
                    oImage.setSrc(absolutePath);
                    oImage.setBackgroundSize("contain");
                    oImage.setBackgroundPosition("center center");
                } else {
                    oImage.setSrc("sap-icon://product");
                }
            }
        }
    }

    // Navigation methods - no auth check needed
    public onMyAccountPress(): void {
        const oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("RouteCustomerDashboard", {});
    }

    public onCartPress(): void {
        const oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("RouteCustomerDashboard", { query: { tab: "cart" } });
    }

    public onWishlistPress(): void {
        const oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("RouteCustomerDashboard", { query: { tab: "wishlist" } });
    }

    public onPersonalInfoPress(): void {
        const oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("RouteCustomerDashboard", { query: { tab: "personalInfo" } });
    }

    public onSupportPress(): void {
        const oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("RouteCustomerDashboard", { query: { tab: "support" } });
    }

    public async onAddToCart(oEvent: any): Promise<void> {
        const oModel = this.getView()!.getModel();
        const oView = this.getView();
        const sCustomerId = getCustomerId(oView);
        const oButton = oEvent.getSource();
        const oParentContainer = oButton.getParent();
        const oStepInput = oParentContainer.getItems()[1];
        oButton.setVisible(false);
        oStepInput.setVisible(true);
        oStepInput.setValue(1);
        const oListBinding = (oModel as any).bindList("/Orders", undefined, undefined, undefined, { $expand: "items" });
        oListBinding.filter(new Filter("IsActiveEntity", FilterOperator.EQ, false));

        oListBinding.requestContexts().then(async (aDraftContexts: any[]) => {
            try {
                oView!.setBusy(true);
                const oProductContext = oButton.getBindingContext();
                const oProduct = oProductContext.getObject();

                if (aDraftContexts.length === 0) {
                    const orderPayload = {
                        "orderNumber": "ORDER-" + new Date().toISOString().replace(/[-:T.Z]/g, ""),
                        "status_code": "OPEN",
                        "customer_ID": sCustomerId
                    };
                    const oNewOrderContext = oListBinding.create(orderPayload);
                    await oNewOrderContext.created();
                    const newOrderID = oNewOrderContext.getObject()?.ID;
                    const oItemsBinding = oModel!.bindList(`/Orders(ID='${newOrderID}',IsActiveEntity=false)/items`) as any;
                    const itemContext = oItemsBinding.create({
                        "parent_ID": newOrderID,
                        "product_ID": oProduct.ID,
                        "quantity": 1,
                        "priceAtOrder": oProduct.price
                    });
                    await itemContext.created();
                } else {
                    const oExistingDraftOrder = aDraftContexts[0].getObject() as any;
                    const oItemsListBinding = (oModel as any).bindList("items", aDraftContexts[0]);
                    const oNewItemContext = oItemsListBinding.create({
                        "parent_ID": oExistingDraftOrder.ID,
                        "product_ID": oProduct.ID,
                        "quantity": 1,
                        "priceAtOrder": oProduct.price
                    });
                    await oNewItemContext.created();
                }
            } catch (oError: any) {
                console.error("Failed to add to cart:", oError);
            } finally {
                this._updateDot();
                oView!.setBusy(false);
            }
        });
    }

    public async getWishlist(): Promise<any[]> {
        const oView = this.getView() as any;
        const oModel = oView!.getModel();
        const sCustomerId = getCustomerId(oView);
        if (!sCustomerId) return [];

        const oWishlistListBinding = (oModel as any).bindList("/Wishlist");
        oWishlistListBinding.filter(new Filter("customer_ID", FilterOperator.EQ, sCustomerId));
        try {
            const aWishlistContexts = await oWishlistListBinding.requestContexts();
            return aWishlistContexts.map((oContext: any) => oContext.getObject());
        } catch (oError) {
            console.error("Failed to read wishlist:", oError);
            return [];
        }
    }

    public async onToggleWishlist(oEvent: any): Promise<void> {
        console.log("adding to wishlist");
        const oButton = oEvent.getSource();
        const oProductContext = oButton.getBindingContext();
        console.log(oProductContext);
        if (!oProductContext) return;

        const sProductId = oProductContext.getProperty("ID");
        const oModel = this.getView()!.getModel();
        const sCustomerId = getCustomerId(this.getView());
        console.log(sCustomerId);
        if (!sCustomerId) return;

        const oWishlistListBinding = (oModel as any).bindList("/Wishlist");

        // Use separate filter calls
        oWishlistListBinding.filter([
            new Filter("customer_ID", FilterOperator.EQ, sCustomerId),
            new Filter("product_ID", FilterOperator.EQ, sProductId)
        ]);

        try {
            this.getView()!.setBusy(true);
            const aExistingFavContexts = await oWishlistListBinding.requestContexts();

            if (aExistingFavContexts.length > 0) {
                await aExistingFavContexts[0].delete();
                oButton.setType("Transparent");
                oButton.setIcon("sap-icon://heart");
            } else {
                const oNewFavContext = oWishlistListBinding.create({
                    "customer_ID": sCustomerId,
                    "product_ID": sProductId
                });
                await oNewFavContext.created();
                oButton.setType("Reject");
                oButton.setIcon("sap-icon://heart");
            }
        } catch (oError) {
            console.error("Wishlist toggle failed:", oError);
        } finally {
            this.getView()!.setBusy(false);
        }
    }

    public onQuantityChange(oEvent: any): void {
        const oStepInput = oEvent.getSource();
        const iNewValue = oEvent.getParameter("value");
        const oParentContainer = oStepInput.getParent();
        const oButton = oParentContainer.getItems()[0];

        if (iNewValue === 0) {
            oStepInput.setVisible(false);
            oButton.setVisible(true);
        }

        const oProductContext = oStepInput.getBindingContext();
        const sProductID = oProductContext.getProperty("ID");
        const oModel = this.getView()!.getModel();
        const oView = this.getView();
        const sCustomerId = getCustomerId(oView);

        const oOrdersBinding = (oModel as any).bindList("/Orders");
        oOrdersBinding.filter(new Filter("IsActiveEntity", FilterOperator.EQ, false));

        oOrdersBinding.requestContexts().then(async (aDraftContexts: any[]) => {
            if (aDraftContexts.length === 0) return;
            const oParentOrderObj = aDraftContexts[0].getObject();
            const sCartID = oParentOrderObj.ID;
            const sCartItemsPath = `/Orders(ID='${sCartID}',IsActiveEntity=false)/items`;
            const oCartItemsBinding = (oModel as any).bindList(sCartItemsPath);
            oCartItemsBinding.filter(new Filter("product_ID", FilterOperator.EQ, sProductID));
            try {
                const aItemContexts = await oCartItemsBinding.requestContexts();
                if (aItemContexts.length > 0) {
                    const oTargetItemContext = aItemContexts[0];
                    if (iNewValue === 0) {
                        oTargetItemContext.delete();
                    } else {
                        oTargetItemContext.setProperty("quantity", iNewValue);
                    }
                }
            } catch (oError) {
                console.error("Quantity update failed:", oError);
            } finally {
                this._updateDot();
            }
        });
    }
}
sap.ui.define(["sap/ui/core/mvc/Controller", "sap/ui/model/Sorter", "sap/ui/model/Filter", "sap/ui/model/FilterOperator", "sap/ui/core/UIComponent", "sap/ui/model/json/JSONModel", "sap/m/Button", "sap/m/ActionSheet"], function (Controller, Sorter, Filter, FilterOperator, UIComponent, JSONModel, Button, ActionSheet) {
  "use strict";

  /**
   * @namespace test.controller
   */

  // Helper to extract customer ID from the model
  function getCustomerId(oView) {
    const oUserModel = oView.getModel("currentUser");
    if (!oUserModel) return "";
    const id = oUserModel.getProperty("/id");
    if (Array.isArray(id) && id.length > 0) return id[0];
    if (typeof id === 'string') return id;
    return "";
  }
  const MainView = Controller.extend("webapp.controller.MainView", {
    onInit: function _onInit() {
      console.log("MAINVIEW ENTER");
      const oModel = this.getOwnerComponent().getModel();
      const oView = this.getView();
      setTimeout(() => {
        const oOperation = oModel.bindContext("/getMyRoles(...)");
        oView.setBusy(true);
        oOperation.execute().then(async () => {
          const oUserObj = oOperation.getBoundContext().getValue();
          const oUserModel = new JSONModel({
            id: oUserObj
          });
          this.getView().setModel(oUserModel, "currentUser");
          await this.syncListAndCart();
          this._updateDot();
          this.fillInPictruresForMainView();
          oView.setBusy(false);
        }).catch(oError => {
          console.log("Browsing as guest:", oError);
          oView.setBusy(false);
        });
      }, 500);
      this.getView().addEventDelegate({
        onBeforeShow: async () => {
          const oUserModel = this.getView().getModel("currentUser");
          if (oUserModel) {
            await this.syncListAndCart();
          }
        }
      });
      const oRouter = UIComponent.getRouterFor(this);
      oRouter.getRoute("RouteCustomerDashboard").attachPatternMatched(this._onRouteMatched, this);
      const oViewModel = new JSONModel({
        activeFilterId: "",
        activeParentId: ""
      });
      this.getView()?.setModel(oViewModel, "localState");
    },
    _onRouteMatched: function _onRouteMatched(oEvent) {
      console.log("matched route");
      this._updateDot();
    },
    onCategoryExpand: function _onCategoryExpand(oEvent) {
      const oPanel = oEvent.getSource();
      if (!oPanel) return;
      const bExpanded = oPanel.getExpanded();
      if (!bExpanded) return;
      const oBindingContext = oPanel.getBindingContext();
      if (!oBindingContext) return;
      const sMainCategoryId = oBindingContext.getProperty("ID");
      const oGridList = this.getView()?.byId("productGrid");
      const oProductBinding = oGridList?.getBinding("items");
      if (oProductBinding) {
        oProductBinding.filter([new Filter("mainCategory_ID", FilterOperator.EQ, sMainCategoryId)]);
      }
    },
    onSubCategorySelect: function _onSubCategorySelect(oEvent) {
      const oSubList = oEvent.getSource();
      const oSelectedContext = oSubList.getSelectedContexts()[0];
      if (!oSelectedContext) return;
      const sSubCategoryId = oSelectedContext.getProperty("ID");
      const sSubCategoryName = oSelectedContext.getProperty("name");
      const oParentContext = oSubList.getBindingContext();
      const sParentMainId = oParentContext ? oParentContext.getProperty("ID") : "";
      const oViewModel = this.getView()?.getModel("localState");
      if (oViewModel) {
        oViewModel.setProperty("/activeFilterId", sSubCategoryId);
        oViewModel.setProperty("/activeParentId", sParentMainId);
      }
      const oGridList = this.getView()?.byId("productGrid");
      const oProductBinding = oGridList?.getBinding("items");
      if (oProductBinding) {
        oProductBinding.filter([new Filter("subCategory_ID", FilterOperator.EQ, sSubCategoryId)]);
      }
    },
    onClearAllFilters: function _onClearAllFilters() {
      const oView = this.getView();
      if (!oView) return;
      const oSearchField = oView.byId("productSearchField");
      if (oSearchField) oSearchField.setValue("");
      const oViewModel = oView.getModel("localState");
      if (oViewModel) {
        oViewModel.setProperty("/activeFilterId", "");
        oViewModel.setProperty("/activeParentId", "");
      }
      const oGridList = oView.byId("productGrid");
      const oProductBinding = oGridList?.getBinding("items");
      if (oProductBinding) {
        oProductBinding.filter([]);
        oProductBinding.sort([]);
      }
      const oMasterList = this.byId("accordionCategoryList");
      if (oMasterList) {
        oMasterList.getItems().forEach(oItem => {
          const oPanel = oItem.getContent?.().find(oCtrl => oCtrl.isA("sap.m.Panel"));
          if (oPanel && oPanel.getExpanded()) oPanel.setExpanded(false);
          const oSubList = oPanel?.getContent().find(oCtrl => oCtrl.isA("sap.m.List"));
          if (oSubList) oSubList.removeSelections(true);
        });
      }
    },
    onPriceSortPress: function _onPriceSortPress(oEvent) {
      const oSourceButton = oEvent.getSource();
      const oView = this.getView();
      if (!oView) return;
      const oActionSheet = new ActionSheet({
        title: "Sort Products by Price",
        placement: "Bottom",
        buttons: [new Button({
          text: "Price: Low to High",
          icon: "sap-icon://sort-ascending",
          press: () => this._applyPriceSorter(false, oSourceButton)
        }), new Button({
          text: "Price: High to Low",
          icon: "sap-icon://sort-descending",
          press: () => this._applyPriceSorter(true, oSourceButton)
        })]
      });
      oView.addDependent(oActionSheet);
      oActionSheet.openBy(oSourceButton);
    },
    _applyPriceSorter: function _applyPriceSorter(bDescending, oButton) {
      if (oButton) {
        oButton.setType("Emphasized");
        oButton.setIcon(bDescending ? "sap-icon://sort-descending" : "sap-icon://sort-ascending");
        oButton.setText(bDescending ? "Price: High-Low" : "Price: Low-High");
      }
      const oGridList = this.byId("productGrid");
      if (!oGridList) return;
      const oProductBinding = oGridList.getBinding("items");
      if (oProductBinding) {
        oProductBinding.sort([new Sorter("price", bDescending)]);
      }
    },
    getCart: async function _getCart() {
      const oModel = this.getView().getModel();
      const oListBinding = oModel.bindList("/Orders", undefined, undefined, undefined, {
        "$expand": "items"
      });
      oListBinding.filter(new Filter("IsActiveEntity", FilterOperator.EQ, false));
      try {
        const aDraftContexts = await oListBinding.requestContexts();
        if (aDraftContexts.length > 0) {
          const oDraftOrderData = aDraftContexts[0].getObject();
          return oDraftOrderData.items || [];
        }
        return [];
      } catch (oError) {
        console.error("getCart failed:", oError);
        return [];
      }
    },
    _updateDot: function _updateDot() {
      const oCartQuantityLabel = this.byId("cartQuantityLabel");
      this.getCart().then(aItems => {
        const iSum = aItems.reduce((acc, item) => acc + item.quantity, 0);
        if (iSum > 0) {
          oCartQuantityLabel.setText(String(iSum));
          oCartQuantityLabel.setVisible(true);
        } else {
          oCartQuantityLabel.setVisible(false);
        }
      });
    },
    syncListAndCart: async function _syncListAndCart() {
      const [items, aWishlistItems] = await Promise.all([this.getCart(), this.getWishlist()]);
      const oGridList = this.byId("productGrid");
      if (!oGridList) return;
      const fnProcessUI = () => {
        const aVisualCards = oGridList.getItems();
        aVisualCards.forEach(oCard => {
          const oBindingContext = oCard.getBindingContext();
          if (!oBindingContext) return;
          const oProductObject = oBindingContext.getObject();
          const oMatchingCartItem = items.find(item => item.product_ID === oProductObject.ID);
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
            const bIsFavorited = aWishlistItems.some(item => item.product_ID === oProductObject.ID);
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
    },
    onProductPress: function _onProductPress(oEvent) {
      const oBindingContext = oEvent.getSource().getBindingContext();
      const sProductId = oBindingContext.getProperty("ID");
      const oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("RouteProductObjectPage", {
        productId: sProductId
      });
    },
    fillInPictruresForMainView: function _fillInPictruresForMainView() {
      const grid = this.byId("productGrid");
      const oView = this.getView();
      const oModel = oView?.getModel();
      const sServiceUrl = oModel.getServiceUrl();
      if (!grid) return;
      const oCards = grid.getItems();
      for (const oCard of oCards) {
        const oContent = oCard.getContent();
        const oImage = oContent[1].getItems()[0];
        const oBindingContext = oCard.getBindingContext();
        if (!oBindingContext) continue;
        const oProductData = oBindingContext.getObject();
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
    },
    // Navigation methods - no auth check needed
    onMyAccountPress: function _onMyAccountPress() {
      const oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("RouteCustomerDashboard", {});
    },
    onCartPress: function _onCartPress() {
      const oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("RouteCustomerDashboard", {
        query: {
          tab: "cart"
        }
      });
    },
    onWishlistPress: function _onWishlistPress() {
      const oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("RouteCustomerDashboard", {
        query: {
          tab: "wishlist"
        }
      });
    },
    onPersonalInfoPress: function _onPersonalInfoPress() {
      const oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("RouteCustomerDashboard", {
        query: {
          tab: "personalInfo"
        }
      });
    },
    onSupportPress: function _onSupportPress() {
      const oRouter = UIComponent.getRouterFor(this);
      oRouter.navTo("RouteCustomerDashboard", {
        query: {
          tab: "support"
        }
      });
    },
    onAddToCart: async function _onAddToCart(oEvent) {
      const oModel = this.getView().getModel();
      const oView = this.getView();
      const sCustomerId = getCustomerId(oView);
      const oButton = oEvent.getSource();
      const oParentContainer = oButton.getParent();
      const oStepInput = oParentContainer.getItems()[1];
      oButton.setVisible(false);
      oStepInput.setVisible(true);
      oStepInput.setValue(1);
      const oListBinding = oModel.bindList("/Orders", undefined, undefined, undefined, {
        $expand: "items"
      });
      oListBinding.filter(new Filter("IsActiveEntity", FilterOperator.EQ, false));
      oListBinding.requestContexts().then(async aDraftContexts => {
        try {
          oView.setBusy(true);
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
            const oItemsBinding = oModel.bindList(`/Orders(ID='${newOrderID}',IsActiveEntity=false)/items`);
            const itemContext = oItemsBinding.create({
              "parent_ID": newOrderID,
              "product_ID": oProduct.ID,
              "quantity": 1,
              "priceAtOrder": oProduct.price
            });
            await itemContext.created();
          } else {
            const oExistingDraftOrder = aDraftContexts[0].getObject();
            const oItemsListBinding = oModel.bindList("items", aDraftContexts[0]);
            const oNewItemContext = oItemsListBinding.create({
              "parent_ID": oExistingDraftOrder.ID,
              "product_ID": oProduct.ID,
              "quantity": 1,
              "priceAtOrder": oProduct.price
            });
            await oNewItemContext.created();
          }
        } catch (oError) {
          console.error("Failed to add to cart:", oError);
        } finally {
          this._updateDot();
          oView.setBusy(false);
        }
      });
    },
    getWishlist: async function _getWishlist() {
      const oView = this.getView();
      const oModel = oView.getModel();
      const sCustomerId = getCustomerId(oView);
      if (!sCustomerId) return [];
      const oWishlistListBinding = oModel.bindList("/Wishlist");
      oWishlistListBinding.filter(new Filter("customer_ID", FilterOperator.EQ, sCustomerId));
      try {
        const aWishlistContexts = await oWishlistListBinding.requestContexts();
        return aWishlistContexts.map(oContext => oContext.getObject());
      } catch (oError) {
        console.error("Failed to read wishlist:", oError);
        return [];
      }
    },
    onToggleWishlist: async function _onToggleWishlist(oEvent) {
      const oButton = oEvent.getSource();
      const oProductContext = oButton.getBindingContext();
      if (!oProductContext) return;
      const sProductId = oProductContext.getProperty("ID");
      const oModel = this.getView().getModel();
      const sCustomerId = getCustomerId(this.getView());
      if (!sCustomerId) return;
      const oWishlistListBinding = oModel.bindList("/Wishlist");

      // Use separate filter calls
      oWishlistListBinding.filter([new Filter("customer_ID", FilterOperator.EQ, sCustomerId), new Filter("product_ID", FilterOperator.EQ, sProductId)]);
      try {
        this.getView().setBusy(true);
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
        this.getView().setBusy(false);
      }
    },
    onQuantityChange: function _onQuantityChange(oEvent) {
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
      const oModel = this.getView().getModel();
      const oView = this.getView();
      const sCustomerId = getCustomerId(oView);
      const oOrdersBinding = oModel.bindList("/Orders");
      oOrdersBinding.filter(new Filter("IsActiveEntity", FilterOperator.EQ, false));
      oOrdersBinding.requestContexts().then(async aDraftContexts => {
        if (aDraftContexts.length === 0) return;
        const oParentOrderObj = aDraftContexts[0].getObject();
        const sCartID = oParentOrderObj.ID;
        const sCartItemsPath = `/Orders(ID='${sCartID}',IsActiveEntity=false)/items`;
        const oCartItemsBinding = oModel.bindList(sCartItemsPath);
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
  });
  return MainView;
});
//# sourceMappingURL=MainView-dbg.controller.js.map

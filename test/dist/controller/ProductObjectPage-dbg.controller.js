sap.ui.define(["sap/ui/core/mvc/Controller", "sap/ui/core/UIComponent", "sap/ui/core/routing/History", "sap/m/Image", "sap/ui/model/Filter", "sap/ui/model/FilterOperator", "sap/ui/model/json/JSONModel"], function (Controller, UIComponent, History, CardImage, Filter, FilterOperator, JSONModel) {
  "use strict";

  /**
   * @namespace test.controller
   */
  const ProductObjectPage = Controller.extend("test.controller.ProductObjectPage", {
    constructor: function constructor() {
      Controller.prototype.constructor.apply(this, arguments);
      this._sCurrentCartId = null;
    },
    onInit: function _onInit() {
      const oRouter = UIComponent.getRouterFor(this);
      // Listen exclusively for pattern matches hitting this specific layout route
      oRouter.getRoute("RouteProductObjectPage").attachPatternMatched(this._onObjectMatched, this);
      const oModel = this.getOwnerComponent().getModel();
      const oOperation = oModel.bindContext("/getMyRoles(...)");
      oOperation.execute().then(() => {
        const sCustomerId = oOperation.getBoundContext().getValue();
        console.log("👤 Current secure Customer ID:", sCustomerId);

        // Save it to a local JSON model so all your functions can use it!
        const oUserModel = new JSONModel({
          id: sCustomerId
        });
        this.getView().setModel(oUserModel, "currentUser");
      });
      this.getView().addEventDelegate({
        onBeforeShow: () => {
          this.getCart();
          this.syncListAndCart();
          this._fillCarouselIn();
        }
      });
    },
    _fillCarouselIn: function _fillCarouselIn() {
      const oCarousel = this.byId("productPhotoCarousel");
      if (!oCarousel) {
        return;
      }
      console.log("Carousel located, initializing OData collection binding...");

      // 🟢 Bind the carousel slides to the relative 'images' association array path
      oCarousel.bindAggregation("pages", {
        path: "images",
        // 💡 Relative to the product detail parent context bind
        parameters: {
          "$select": "content,fileName,mediaType" // Optimize OData load payload
        },
        // 🟢 The factory function runs for every photo row in your table database
        factory: (sId, oContext) => {
          // 1. Get the frontend data model reference
          const oModel = this.getView().getModel();

          // 2. Extract the base backend server origin path (e.g., "http://localhost:4004/odata/v4/crm/")
          const sServiceUrl = oModel.getServiceUrl();

          // 3. 🟢 COMBINE THEM: Strip the leading slash from the context path and append it to the base URL
          const sRelativeContextPath = oContext.getPath().substring(1); // Removes the "/" from the beginning
          const sImageStreamUrl = sServiceUrl + sRelativeContextPath + "/content";
          console.log("🟢 Absolute streaming image source URL destination constructed:", sImageStreamUrl);
          // It should cleanly evaluate to: http://localhost:4004/odata/v4/crm/Products(...)/images(...)/content

          const sFileName = oContext.getProperty("fileName");

          // 4. Return your updated card layout control
          return new CardImage(sId, {
            src: sImageStreamUrl,
            alt: sFileName,
            width: "100%",
            height: "100%",
            mode: "Background",
            backgroundSize: "contain",
            backgroundPosition: "center center"
          });
        }
      });
    },
    _onObjectMatched: function _onObjectMatched(oEvent) {
      const oArguments = oEvent.getParameter("arguments");
      const sProductId = oArguments.productId;
      console.log("🔍 Navigating to Product ID:", sProductId);
      if (sProductId) {
        const oView = this.getView();
        if (!oView) {
          return;
        }
        oView.bindElement({
          path: `/Products(ID='${sProductId}')`,
          parameters: {
            $select: "title",
            $expand: "vendor,images"
          },
          events: {
            dataReceived: () => {
              console.log("OData background data received successfully");
              this._fillCarouselIn();
            }
          }
        });
        const oIconTab = this.byId("productDetailsTabBar");
        oIconTab.setSelectedKey("productDescription");
      }
    },
    formatMarketingBadgeText: function _formatMarketingBadgeText(fPrice, iStock, iTimesOrdered) {
      if (fPrice === undefined || fPrice === null) {
        return "";
      }

      // Priority 1: High Urgency (Low Inventory)
      if (iStock > 0 && iStock <= 10) {
        return "Almost Gone";
      }

      // Priority 2: Price Brackets
      if (fPrice >= 1000) {
        return "Ultra Luxury";
      } else if (fPrice >= 500) {
        return "Premium Choice";
      } else if (fPrice <= 50) {
        return "Great Value";
      }

      // Priority 3: Velocity Metrics Fallback
      if (iTimesOrdered >= 100) {
        return "Top Seller";
      }
      return "Staff Pick"; // Uniform baseline fallback label
    },
    formatMarketingBadgeStatus: function _formatMarketingBadgeStatus(fPrice, iStock, iTimesOrdered) {
      if (fPrice === undefined || fPrice === null) {
        return "None";
      }
      if (iStock > 0 && iStock <= 10) {
        return "Error"; // Red warning indicator
      }
      if (fPrice >= 1000) {
        return "Warning"; // Orange highlight indicator
      } else if (fPrice >= 500) {
        return "Information"; // Blue corporate accent indicator
      }
      return "Success"; // Green positive indicator for bargains/top sellers
    },
    onNavBack: function _onNavBack() {
      const oHistory = History.getInstance();
      const sPreviousHash = oHistory.getPreviousHash();
      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        const oRouter = UIComponent.getRouterFor(this);
        oRouter.navTo("RouteMainView", {}, true);
      }
    },
    // Track the active cart draft globally or use a shared state fallback
    onAddProductToCart: async function _onAddProductToCart(oEvent) {
      console.log("custom controller");
      const oModel = this.getView().getModel();
      const oView = this.getView();
      let id = 0;
      const oUserModel = oView.getModel("currentUser");
      if (oUserModel) {
        const sCustomerId = oUserModel.getProperty("/id");
        console.log("🎯 Found Customer ID inside onAddToCart:", sCustomerId.id);
        id = sCustomerId.id;
      }
      const oButton = oEvent.getSource();
      const oParentContainer = oButton.getParent();
      const oStepInput = oParentContainer.getItems()[1];
      oButton.setVisible(false);
      oStepInput.setVisible(true);
      oStepInput.setValue(1);
      const oListBinding = oModel.bindList("/Orders");
      const oDraftFilter = new Filter("IsActiveEntity", FilterOperator.EQ, false);
      oListBinding.filter(oDraftFilter);
      oListBinding.requestContexts().then(async aDraftContexts => {
        console.log(`Found ${aDraftContexts.length} draft records.`);
        if (aDraftContexts.length === 0) {
          try {
            oView.setBusy(true); // Lock the canvas layout
            const data = {
              "orderNumber": "test-num",
              "status_code": "OPEN",
              "customer_ID": id
            };
            console.log(data);
            const oNewDraftContext = oListBinding.create(data);
            await oNewDraftContext.created();
            console.log("NEW DRAFT CREATED");
            const sNewDraftId = oNewDraftContext.getProperty("ID");
            console.log(sNewDraftId);
            const sDraftItemPath = `/Orders(ID='${sNewDraftId}',IsActiveEntity=false)/items`;
            const oItemsListBinding = oModel.bindList(sDraftItemPath);
            const oProductContext = oButton.getBindingContext();
            const oProduct = oProductContext.getObject();
            const itemData = {
              "parent_ID": id,
              "product_ID": oProduct.ID,
              "quantity": 1,
              "priceAtOrder": oProduct.price
            };
            const oNewItemContext = oItemsListBinding.create(itemData);
            await oNewItemContext.created();
          } catch (oError) {
            console.error("❌ Failed to create draft item:", oError);
          } finally {
            console.log("unblocked");
            oView.setBusy(false);
          }
        } else {
          try {
            oView.setBusy(true); // Lock the canvas layout
            const existingDraftOrder = aDraftContexts[0].getObject();
            console.log(existingDraftOrder);
            console.log("existing Draft Id", existingDraftOrder.ID);
            const sDraftItemPath = `/Orders(ID='${existingDraftOrder.ID}',IsActiveEntity=false)/items`;
            const oItemsListBinding = oModel.bindList(sDraftItemPath);
            const oProductContext = oButton.getBindingContext();
            const oProduct = oProductContext.getObject();
            const data = {
              "parent_ID": id,
              "product_ID": oProduct.ID,
              "quantity": 1,
              "priceAtOrder": oProduct.price
            };
            const oNewItemContext = oItemsListBinding.create(data);
            await oNewItemContext.created();
          } catch (oError) {
            console.error("❌ Failed to create draft item:", oError);
          } finally {
            console.log("unblocked");
            oView.setBusy(false); // Unlock the canvas layout
          }
        }
        aDraftContexts.forEach(oContext => {
          console.log("Draft Data:", oContext.getObject());
        });
      });
    },
    onObjectPageQuantityChange: function _onObjectPageQuantityChange(oEvent) {
      console.log("change");
      const oStepInput = oEvent.getSource();
      const iNewValue = oEvent.getParameter("value");
      console.log(iNewValue);
      const oParentContainer = oStepInput.getParent();
      const oButton = oParentContainer.getItems()[0];

      // UI Logic: Hide if quantity drops to 0
      if (iNewValue === 0) {
        oStepInput.setVisible(false);
        oButton.setVisible(true);
        // Tip: Remember to toggle your blue "Add to Cart" button back to true here if needed
      }
      const oProductContext = oStepInput.getBindingContext();
      const sProductID = oProductContext.getProperty("ID");
      const oModel = this.getView().getModel();
      const oView = this.getView();

      // 1. Correctly read the customer ID string
      let sCustomerIdStr = "";
      const oUserModel = oView.getModel("currentUser");
      if (oUserModel) {
        sCustomerIdStr = oUserModel.getProperty("/id"); // Removed the extra .id
        console.log("🎯 Found Customer ID inside onQuantityChange:", sCustomerIdStr);
      }

      // 2. Query Orders to find the active draft cart
      const oOrdersBinding = oModel.bindList("/Orders");
      const oDraftFilter = new Filter("IsActiveEntity", FilterOperator.EQ, false);
      oOrdersBinding.filter(oDraftFilter);
      oOrdersBinding.requestContexts().then(async aDraftContexts => {
        if (aDraftContexts.length === 0) {
          console.warn("⚠️ No active draft cart found in DB.");
          return;
        }
        const oParentOrderObj = aDraftContexts[0].getObject();
        const sCartID = oParentOrderObj.ID;

        // 3. Build the path to the items collection inside this specific cart
        const sCartItemsPath = `/Orders(ID='${sCartID}',IsActiveEntity=false)/items`;
        const oCartItemsBinding = oModel.bindList(sCartItemsPath);

        // 4. CRUCIAL: Filter the items list binding to match the product clicked!
        const oProductFilter = new Filter("product_ID", FilterOperator.EQ, sProductID);
        oCartItemsBinding.filter(oProductFilter);
        try {
          // 5. Ask the database to fetch the specific item context row
          const aItemContexts = await oCartItemsBinding.requestContexts();
          if (aItemContexts.length > 0) {
            // SUCCESS: This is your true unique item context pointer!
            const oTargetItemContext = aItemContexts[0];
            if (iNewValue === 0) {
              console.log(`🗑️ Deleting item from draft cart DB...`);
              oTargetItemContext.delete();
            } else {
              // 🟢 This will now successfully trigger your HTTP PATCH request!
              console.log(`🔄 Setting property quantity to ${iNewValue}`);
              oTargetItemContext.setProperty("quantity", iNewValue);
            }
          } else {
            console.warn("⚠️ This product isn't actually in the database draft cart.");
          }
        } catch (oError) {
          console.error("❌ Database update failed:", oError);
        }
      });
    },
    getCart: async function _getCart() {
      console.log("custom controller");
      const oModel = this.getView().getModel();
      const oView = this.getView();
      let id = 0;
      const oUserModel = oView.getModel("currentUser");
      if (oUserModel) {
        const sCustomerId = oUserModel.getProperty("/id");
        const sIdValue = sCustomerId?.id ? sCustomerId.id : sCustomerId;
        id = sIdValue;
      }
      const oListBinding = oModel.bindList("/Orders");
      const oDraftFilter = new Filter("IsActiveEntity", FilterOperator.EQ, false);
      oListBinding.filter(oDraftFilter);
      try {
        // 1. Await the draft order lookups
        const aDraftContexts = await oListBinding.requestContexts();
        if (aDraftContexts.length > 0) {
          const existingDraftOrder = aDraftContexts[0].getObject();
          const sDraftItemPath = `/Orders(ID='${existingDraftOrder.ID}',IsActiveEntity=false)/items`;
          const oItemsBinding = oModel.bindList(sDraftItemPath);

          // 2. Await the nested order line items from the database
          const aItemContexts = await oItemsBinding.requestContexts();

          // 3. 🟢 THE CHANGE: Map the context arrays into clean JavaScript data objects
          const aItemsArray = aItemContexts.map(oItemContext => {
            return oItemContext.getObject();
          });
          console.log(`🚀 Returning array of ${aItemsArray.length} items.`);
          return aItemsArray; // Returns the clean plain object array: [{product_ID: "...", quantity: 1}, ...]
        } else {
          console.log("ℹ️ No active draft cart records found.");
          return []; // Return an empty array if no cart exists
        }
      } catch (oError) {
        console.error("❌ getCart failed:", oError);
        return []; // Return empty array on database failure
      }
    },
    syncListAndCart: async function _syncListAndCart() {
      // 1. Unpack your asynchronous cart items array
      console.log("sync prod page . . .");
      const oButton = this.byId("heroAddToCartButton");
      const oStepInput = this.byId("productQuantityInput");
      oButton.setVisible(true);
      oStepInput.setVisible(false);
      const items = await this.getCart();
      console.log("items ", items);
      const productPage = this.byId("heroLayout");
      if (!productPage) {
        console.log("no product page");
        return;
      }
      const oContext = productPage.getBindingContext();
      if (!oContext) {
        console.log("no context");
        return;
      }
      const object = oContext.getObject();
      console.log(object);
      const oMatchingCartItem = items.find(item => item.product_ID === object.ID);
      if (oMatchingCartItem) {
        console.log("changing . . . ");
        oButton.setVisible(false);
        oStepInput.setVisible(true);
        oStepInput.setValue(oMatchingCartItem.quantity);
      }
    }
  });
  return ProductObjectPage;
});
//# sourceMappingURL=ProductObjectPage-dbg.controller.js.map

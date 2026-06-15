import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import History from "sap/ui/core/routing/History";
import CardImage from "sap/m/Image"; 


import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import JSONModel from "sap/ui/model/json/JSONModel";
import IconTabBar from "sap/m/IconTabBar";


/**
 * @namespace test.controller
 */
export default class ProductObjectPage extends Controller {
    private _sCurrentCartId: string | null = null;

    public onInit(): void {
        const oRouter = UIComponent.getRouterFor(this);
        oRouter.getRoute("RouteProductObjectPage")!.attachPatternMatched(this._onObjectMatched, this);
        const oModel = this.getOwnerComponent()!.getModel();
                const oOperation = (oModel as any).bindContext("/getMyRoles(...)");
                oOperation.execute().then(() => {
                const sCustomerId = oOperation.getBoundContext().getValue();
                console.log("👤 Current secure Customer ID:", sCustomerId);
                
                const oUserModel = new JSONModel({ id: sCustomerId });
                this.getView()!.setModel(oUserModel, "currentUser");
                });
        
                
                this.getView()!.addEventDelegate({
                onBeforeShow: () => {
                    this.getCart();
                    this.syncListAndCart();
                    this._fillCarouselIn();
                }});
    }

    
private _fillCarouselIn(): void {
    const oCarousel = this.byId("productPhotoCarousel") as any;
    if (!oCarousel) { return; }

    console.log("Carousel located, initializing OData collection binding...");

    oCarousel.bindAggregation("pages", {
        path: "images", 
        parameters: {
            "$select": "content,fileName,mediaType" 
        },
        factory: (sId: string, oContext: any) => {
    const oModel = this.getView()!.getModel() as any ;
    
    const sServiceUrl = oModel!.getServiceUrl(); 

    const sRelativeContextPath = oContext.getPath().substring(1); 
    const sImageStreamUrl = sServiceUrl + sRelativeContextPath + "/content";


    const sFileName = oContext.getProperty("fileName");

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
}




private _onObjectMatched(oEvent: any): void {
    const oArguments = oEvent.getParameter("arguments");
    const sProductId = oArguments.productId;
    console.log("🔍 Navigating to Product ID:", sProductId);

    if (sProductId) {
        const oView = this.getView();
        if (!oView) { return; }

        oView.bindElement({
            path: `/Products(ID='${sProductId}')`,            
            parameters: {
                $select:"title",
                $expand: "vendor,images" 
            },
            events: {
                dataReceived: () => {
                    console.log("OData background data received successfully");
                    this._fillCarouselIn();
                }
            }
        });
        const oIconTab =this.byId("productDetailsTabBar") as IconTabBar;
        oIconTab.setSelectedKey("productDescription");
    }
}



public formatMarketingBadgeText(fPrice: number, iStock: number, iTimesOrdered: number): string {
        if (fPrice === undefined || fPrice === null) { return ""; }

        if (iStock > 0 && iStock <= 10) {
            return "Almost Gone";
        }

        if (fPrice >= 1000) {
            return "Ultra Luxury";
        } else if (fPrice >= 500) {
            return "Premium Choice";
        } else if (fPrice <= 50) {
            return "Great Value";
        }

        if (iTimesOrdered >= 100) {
            return "Top Seller";
        }

        return "Staff Pick"; 
    }

    public formatMarketingBadgeStatus(fPrice: number, iStock: number, iTimesOrdered: number): string {
        if (fPrice === undefined || fPrice === null) { return "None"; }

        if (iStock > 0 && iStock <= 10) {
            return "Error"; 
        }

        if (fPrice >= 1000) {
            return "Warning";
        } else if (fPrice >= 500) {
            return "Information"; 
        }

        return "Success"; 
    }


    public onNavBack(): void {
        const oHistory = History.getInstance();
        const sPreviousHash = oHistory.getPreviousHash();

        if (sPreviousHash !== undefined) {
            window.history.go(-1);
        } else {
            const oRouter = UIComponent.getRouterFor(this);
            oRouter.navTo("RouteMainView", {}, true);
        }
    }


public async onAddProductToCart(oEvent: any): Promise<void> {
        console.log("custom controller");
        const oModel = this.getView()!.getModel();
        const oView = this.getView();
        let id = 0;
        const oUserModel= oView!.getModel("currentUser") as any;
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
        const oListBinding = (oModel as any).bindList("/Orders");
        const oDraftFilter = new Filter("IsActiveEntity", FilterOperator.EQ, false);
        oListBinding.filter(oDraftFilter);
        oListBinding.requestContexts().then(async (aDraftContexts: any[]) => {
        console.log(`Found ${aDraftContexts.length} draft records.`);
        if (aDraftContexts.length===0){
            try{
                oView!.setBusy(true);
                const data = {
                    "orderNumber":"test-num",
                    "status_code":"OPEN",
                    "customer_ID":id
                };
                console.log(data);
                const oNewDraftContext = oListBinding.create(data);
                await oNewDraftContext.created();
                console.log("NEW DRAFT CREATED");
                const sNewDraftId = oNewDraftContext.getProperty("ID");
                console.log(sNewDraftId);
                const sDraftItemPath = `/Orders(ID='${sNewDraftId}',IsActiveEntity=false)/items`;
                const oItemsListBinding = (oModel as any).bindList(sDraftItemPath);
                const oProductContext = oButton.getBindingContext();
                const oProduct = oProductContext.getObject();
                const itemData = {
                    "parent_ID":id,
                    "product_ID":oProduct.ID,
                    "quantity":1,
                    "priceAtOrder":oProduct.price


                };
                const oNewItemContext = oItemsListBinding.create(itemData);
                await oNewItemContext.created();
            }catch(oError:any){
                console.error("Failed to create draft item:", oError);
            }finally{
                console.log("unblocked");
                oView!.setBusy(false); 
            }
            
        }else{
            try{
                oView!.setBusy(true); 
                const existingDraftOrder = aDraftContexts[0].getObject();
                console.log(existingDraftOrder);
                console.log("existing Draft Id",existingDraftOrder.ID);
                const sDraftItemPath = `/Orders(ID='${existingDraftOrder.ID}',IsActiveEntity=false)/items`;
                const oItemsListBinding = (oModel as any).bindList(sDraftItemPath);
                const oProductContext = oButton.getBindingContext();
                const oProduct = oProductContext.getObject();
                const data = {
                    "parent_ID":id,
                    "product_ID":oProduct.ID,
                    "quantity":1,
                    "priceAtOrder":oProduct.price


                };
                const oNewItemContext = oItemsListBinding.create(data);
                await oNewItemContext.created();
                } catch(oError:any){
                    console.error("Failed to create draft item:", oError);
                }finally {
                    console.log("unblocked");
                    oView!.setBusy(false); 
            }
            
            

        }
        aDraftContexts.forEach((oContext) => {
            console.log("Draft Data:", oContext.getObject());
        });

    });
}


   
public onObjectPageQuantityChange(oEvent: any): void {
    console.log("change");
    const oStepInput = oEvent.getSource();
    const iNewValue = oEvent.getParameter("value");
    console.log(iNewValue);
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

    let sCustomerIdStr = "";
    const oUserModel = oView!.getModel("currentUser") as any;
    if (oUserModel) {
        sCustomerIdStr = oUserModel.getProperty("/id"); 
        console.log("Found Customer ID inside onQuantityChange:", sCustomerIdStr);
    }

    const oOrdersBinding = (oModel as any).bindList("/Orders");
    const oDraftFilter = new Filter("IsActiveEntity", FilterOperator.EQ, false);
    oOrdersBinding.filter(oDraftFilter);

    oOrdersBinding.requestContexts().then(async (aDraftContexts: any[]) => {
        if (aDraftContexts.length === 0) {
            console.warn("No active draft cart found in DB.");
            return;
        }

        const oParentOrderObj = aDraftContexts[0].getObject();
        const sCartID = oParentOrderObj.ID;

        const sCartItemsPath = `/Orders(ID='${sCartID}',IsActiveEntity=false)/items`;
        const oCartItemsBinding = (oModel as any).bindList(sCartItemsPath);

        const oProductFilter = new Filter("product_ID", FilterOperator.EQ, sProductID);
        oCartItemsBinding.filter(oProductFilter);

        try {
            const aItemContexts = await oCartItemsBinding.requestContexts();

            if (aItemContexts.length > 0) {
                const oTargetItemContext = aItemContexts[0];

                if (iNewValue === 0) {
                    console.log(`Deleting item from draft cart DB...`);
                    oTargetItemContext.delete();
                } else {
                    console.log(`Setting property quantity to ${iNewValue}`);
                    oTargetItemContext.setProperty("quantity", iNewValue);
                }
            } else {
                console.warn("This product isn't actually in the database draft cart.");
            }
        } catch (oError) {
            console.error("Database update failed:", oError);
        }
    });
}

public async getCart(): Promise<any[]> {
    console.log("custom controller");
    const oModel = this.getView()!.getModel();
    const oView = this.getView();
    let id = 0;
    
    const oUserModel = oView!.getModel("currentUser") as any;
    if (oUserModel) {
        const sCustomerId = oUserModel.getProperty("/id");
        const sIdValue = sCustomerId?.id ? sCustomerId.id : sCustomerId;
        id = sIdValue;
    }

    const oListBinding = (oModel as any).bindList("/Orders");
    const oDraftFilter = new Filter("IsActiveEntity", FilterOperator.EQ, false);
    oListBinding.filter(oDraftFilter);
    
    try {
        const aDraftContexts = await oListBinding.requestContexts();
        
        if (aDraftContexts.length > 0) {
            const existingDraftOrder = aDraftContexts[0].getObject();
            const sDraftItemPath = `/Orders(ID='${existingDraftOrder.ID}',IsActiveEntity=false)/items`;
            
            const oItemsBinding = (oModel as any).bindList(sDraftItemPath);
            const aItemContexts = await oItemsBinding.requestContexts();
            const aItemsArray = aItemContexts.map((oItemContext: any) => {
                return oItemContext.getObject(); 
            });

            console.log(`Returning array of ${aItemsArray.length} items.`);
            return aItemsArray;
            
        } else {
            console.log("ℹNo active draft cart records found.");
            return []; 
        }
        
    } catch (oError) {
        console.error("getCart failed:", oError);
        return []; 
    }
}

    public async syncListAndCart(): Promise<void> {
    console.log("sync prod page . . .");
    const oButton = this.byId("heroAddToCartButton") as any ; 
    const oStepInput = this.byId("productQuantityInput") as any ; 
    oButton.setVisible(true);
    oStepInput.setVisible(false);
    const items = await this.getCart();
    console.log("items ",items);
    const productPage = this.byId("heroLayout") as any ;
    if(!productPage){
        console.log("no product page");
        return; 
    }
    const oContext = productPage.getBindingContext();
    if(!oContext){
        console.log("no context");
        return;
    }

    const object = oContext.getObject();
    console.log(object);

    const oMatchingCartItem = items.find((item:any)=>item.product_ID===object.ID);
    if (oMatchingCartItem){
        console.log("changing . . . ");
        oButton.setVisible(false);
        oStepInput.setVisible(true);
        oStepInput.setValue(oMatchingCartItem.quantity);
    }


    

    
}


}









frappe.ui.form.on("Sales Invoice", {

    timeline_refresh: function (frm) {
        // create button for "Add to Knowledge Base"
        frm.add_custom_button(__('Criar NF-e'), function () {
            frappe.call({
                type: "GET",
                method: "nfe_nfce_erpnext.api.criarNotaFiscal",

                args: {
                    "server_invoice": frm.doc.name,
                    "modelo": 1
                },
                callback: function (r) {
                    console.log(r)
                    if (!r.exc) {
                        var doc = frappe.model.sync(r.message);
                        frappe.set_route("Form", r.message.doctype, r.message.name);
                    }
                }
            });
        })
    },
});

frappe.ui.form.on("POS Invoice", {

    timeline_refresh: function (frm) {
        // create button for "Add to Knowledge Base"
        frm.add_custom_button(__('Criar NFC-e'), function () {
            frappe.call({
                type: "GET",
                method: "nfe_nfce_erpnext.api.criarNotaFiscal",

                args: {
                    "server_pos_invoice": frm.doc.name,
                    "modelo": 2
                },
                callback: function (r) {
                    console.log(r)
                    if (!r.exc) {
                        var doc = frappe.model.sync(r.message);
                        frappe.set_route("Form", r.message.doctype, r.message.name);
                    }
                }
            });
        })
    },
});

frappe.ui.form.on("Customer", {
    refresh: function (frm) {
        frm.add_custom_button(
            __("Puxar dados CNPJ"), () => { pullDataCNPJ(frm) }, __("Actions")
        );
    }
})

frappe.ui.form.on("Supplier", {
    refresh: function (frm) {
        frm.add_custom_button(
            __("Puxar dados CNPJ"), () => { pullDataCNPJ(frm) }, __("Actions")
        );
    }
})

function pullDataCNPJ(frm) {
    if (frm.doc.__unsaved) {
        frappe.throw("Salve o documento antes de prosseguir")
        return
    } else {
        if ((frm.doc.doctype == "Supplier" && frm.doc.supplier_type !== "Company") || (frm.doc.doctype == "Customer" && frm.doc.customer_type !== "Company")) {
            frappe.throw("Cliente precisa ser uma empresa")
            return
        } else {
            frappe.call({
                type: "GET",
                method: "nfe_nfce_erpnext.api.pullDataCNPJ",

                args: {
                    "doc": frm.doc.name,
                    "cnpj": frm.doc.tax_id,
                    "doctype": frm.doc.doctype
                },
                callback: function (r) {
                    frm.reload_doc()
                    // console.log(r)
                    /*if (!r.exc) {
                        var doc = frappe.model.sync(r.message);
                        frappe.set_route("Form", r.message.doctype, r.message.name);
                    }*/
                },
                freeze:true,
            });
        }
    }
}
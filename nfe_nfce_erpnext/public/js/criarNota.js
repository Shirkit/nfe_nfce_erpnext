frappe.ui.form.on("Sales Invoice", {

	timeline_refresh: function(frm) {
		// create button for "Add to Knowledge Base"
        frm.add_custom_button(__('Criar NF-e'), function() {
            frappe.call({
                type: "GET",
                method: "nfe_nfce_erpnext.api.criarNotaFiscal",
                
                args: {
                    "server_pos_invoice": frm.doc.name
                },
                callback: function(r) {
                    console.log(r)
                    if(!r.exc) {
                        var doc = frappe.model.sync(r.message);
                        frappe.set_route("Form", r.message.doctype, r.message.name);
                    }
                }
            });
        })
	},
});

frappe.ui.form.on("POS Invoice", {

	timeline_refresh: function(frm) {
		// create button for "Add to Knowledge Base"
        frm.add_custom_button(__('Criar NF-e'), function() {
            frappe.call({
                type: "GET",
                method: "nfe_nfce_erpnext.api.criarNotaFiscal",
                
                args: {
                    "server_pos_invoice": frm.doc.name
                },
                callback: function(r) {
                    console.log(r)
                    if(!r.exc) {
                        var doc = frappe.model.sync(r.message);
                        frappe.set_route("Form", r.message.doctype, r.message.name);
                    }
                }
            });
        })
	},
});
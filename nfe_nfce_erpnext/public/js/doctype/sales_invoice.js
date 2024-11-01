frappe.ui.form.on("POS Invoice", {

    timeline_refresh: function (frm) {
        add_nf_buttons(frm, "server_pos_invoice")
    },
});

frappe.ui.form.on("Sales Invoice", {

    timeline_refresh: function (frm) {
        add_nf_buttons(frm, "server_invoice")
    },
});


function add_nf_buttons(frm, server_invoice) {
    frm.add_custom_button(__('Criar NF-e'), function () {
        frappe.call({
            type: "GET",
            method: "nfe_nfce_erpnext.api.criarNotaFiscal",

            args: {
                [server_invoice]: frm.doc.name,
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

    frm.add_custom_button(__('Criar NFC-e'), function () {
        frappe.call({
            type: "GET",
            method: "nfe_nfce_erpnext.api.criarNotaFiscal",

            args: {
                [server_invoice] : frm.doc.name,
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
}
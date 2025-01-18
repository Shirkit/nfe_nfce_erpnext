frappe.ui.form.on("Nota Fiscal", {

    timeline_refresh: function (frm) {
        // create button for "Add to Knowledge Base"
        if (frm.doc.docstatus === 1) {
            if ((!frm.doc.chave || frm.doc.status.toLowerCase() != "aprovado")) {
                frm.page.add_action_item(__('Emitir Nota'), function () {
                    if (frm.doc.__unsaved) {
                        frappe.throw("Salve a nota antes de emitir");
                        return;
                    } else
                        frappe.call({
                            type: "GET",
                            method: "nfe_nfce_erpnext.api.emitirNotaFiscal",

                            args: {
                                "source_name": frm.doc
                            },
                            callback: function (r) {
                                console.log(r);
                                if (r.message) {
                                    var msg = JSON.parse(r.message);
                                    if (msg.error)
                                        frappe.throw(msg.error);
                                    else if (msg.success === true) {
                                        console.log(msg);
                                        frappe.msgprint("Nota emitida com sucesso. " + msg.modelo + " - " + msg.chave);
                                        frm.refresh();
                                        // TODO tentar imprimir com QZTray
                                    }
                                }
                            }
                        });
                });
            } else {
                if (frm.doc.status.toLowerCase() === "aprovado") {
                    frm.page.add_action_item(__('Abrir Danfe'), function () {
                        window.open('https://nfe.webmaniabr.com/danfe/' + frm.doc.chave, '_blank');
                    });
                    frm.page.add_action_item(__('Abrir Danfe Simples'), function () {
                        window.open('https://nfe.webmaniabr.com/danfe/simples/' + frm.doc.chave, '_blank');
                    });
                    frm.page.add_action_item(__('Abrir Danfe Etiqueta'), function () {
                        window.open('https://nfe.webmaniabr.com/danfe/etiqueta/' + frm.doc.chave, '_blank');
                    });
                    frm.page.add_action_item(__('Abrir XML'), function () {
                        window.open('https://nfe.webmaniabr.com/xmlnfe/' + frm.doc.chave, '_blank');
                    });
                }
            }
        }
    },
    onload: function (frm) {
        // frappe.msgprint("onload");
        window.frm = frm;
    },

    /*refresh: function (frm) {
         frappe.msgprint("refresh");
    }*/
});
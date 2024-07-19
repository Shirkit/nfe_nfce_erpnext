frappe.provide('erpnext.PointOfSale');
frappe.require('point-of-sale.bundle.js', function () {

    erpnext.PointOfSale.Controller = class MyPosController extends erpnext.PointOfSale.Controller {
        constructor(wrapper) {
            super(wrapper)
        }
    }

    erpnext.PointOfSale.PastOrderSummary = class MyPastOrderSummary extends erpnext.PointOfSale.PastOrderSummary {
        constructor({ wrapper, events }) {
            events.imprimir_nf = (name) => {
                frappe.run_serially([
                    () => this.imprimir_nf(name),
                ])
            }

            super({ wrapper, events })
        }

        imprimir_nf(name) {
            frappe.call({
                type: "GET",
                method: "nfe_nfce_erpnext.api.imprimirNotaFiscal",

                args: {
                    "server_pos_invoice": name,
                },
                callback: function (r) {
                    //console.log(r)
                    if (r.message) {
                        parse = JSON.parse(r.message)
                        console.log(parse)
                        if (parse.html) {
                            parse.html = parse.html.replaceAll("\n", "")
                        }
                        //var doc = frappe.model.sync(r.message);
                        //frappe.set_route("Form", r.message.doctype, r.message.name);
                    }
                }
            });

        }

        get_condition_btn_map(after_submission) {
            let returned = super.get_condition_btn_map(after_submission)

            if (after_submission)
                returned[0].visible_btns.push('Imprimir NFC-e')
            /*else {
                returned[1].visible_btns.push('Emitir NFC-e')
                returned[2].visible_btns.push('Emitir NFC-e')
            }*/

            return returned
        }

        bind_events() {
            super.bind_events()
            this.$summary_container.on("click", ".imprimir-btn", () => {
                console.log("Imprimir NFC-e")
                this.events.imprimir_nf(this.doc.name)
            })

            console.log(this.events)
        }
    }

})
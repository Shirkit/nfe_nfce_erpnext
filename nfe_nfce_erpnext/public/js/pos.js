frappe.provide('erpnext.PointOfSale')
frappe.require('point-of-sale.bundle.js', function () {

    function qz_connect() {
        return new Promise(function (resolve, reject) {
            if (qz && qz.websocket && qz.websocket.isActive()) {
                resolve()
            } else {
                frappe.ui.form.qz_connect().then(() => {
                }).then(resolve, reject)
            }
        })
    }

    default_printer = null

    async function qz_print(job) {
        var options = {}
        if (job.printerOptions)
            options = job.printerOptions

        var data = [{
            type: 'pixel',
            format: 'html',
            flavor: 'plain',
            data: job.html
        }]

        if (!default_printer)
            default_printer = await qz.printers.getDefault()

        // TODO Add support for more printers than just the default one to print NF-e on the network
        var config = qz.configs.create(default_printer, options)

        return qz_connect().then(function () {
            for (var i = 0; i < (job.copies ? job.copies : 1); i++) {
                qz.print(config, data).catch(function (e) {
                    console.error(e)
                }).then(function (e) {
                })
            }
        })
    }

    var cfg = null;
    function qz_config() {
        if (cfg == null) {
            cfg = qz.configs.create(null)
        }

        return cfg
    }

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
                        let parse = JSON.parse(r.message)
                        // console.log(parse)
                        if (parse.html) {
                            parse.html = parse.html.replaceAll("\n", "")
                            qz_connect().then(() => {
                                qz_print({ html: parse.html, copies: 1 })
                            })
                        }
                        //var doc = frappe.model.sync(r.message)
                        //frappe.set_route("Form", r.message.doctype, r.message.name)
                    }
                }
            })

            frappe.ui.form.qz_init().then(() => {

                qz.security.setCertificatePromise(function (resolve, reject) {
                    fetch(document.location.origin + "/assets/nfe_nfce_erpnext/cert.pem", { cache: 'no-store', headers: { 'Content-Type': 'text/plain' } })
                        .then(function (data) { data.ok ? resolve(data.text()) : reject(data.text()) })
                })

                qz.security.setSignatureAlgorithm("SHA512") // Since 2.1
                qz.security.setSignaturePromise(function (toSign) {
                    return function (resolve, reject) {
                        fetch(document.location.origin + "/api/method/nfe_nfce_erpnext.api.signQz?message=" + toSign, { cache: 'no-store', headers: { 'Content-Type': 'text/plain' } })
                            .then(function (data) { data.ok ? resolve(data.text()) : reject(data.text()) })
                    }
                })

                qz_connect()
            })

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
                // console.log("Imprimir NFC-e")
                this.events.imprimir_nf(this.doc.name)
            })
            // console.log(this.events)
        }
    }

})
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

    // TODO: Migrate this into another custom APP exclsuive for Orquidario Bahia or POS
    erpnext.PointOfSale.ItemSelector = class MyPosSelector extends erpnext.PointOfSale.ItemSelector {
        constructor({ frm, wrapper, events, pos_profile, settings }) {
            super({ frm, wrapper, events, pos_profile, settings })
        }

        get_item_html(item) {
            const me = this;
            // eslint-disable-next-line no-unused-vars
            const { item_image, serial_no, batch_no, barcode, actual_qty, uom, price_list_rate, description } = item;
            const precision = flt(price_list_rate, 2) % 1 != 0 ? 2 : 0;
            let indicator_color;
            let qty_to_display = actual_qty;

            if (item.is_stock_item) {
                indicator_color = actual_qty > 10 ? "green" : actual_qty <= 0 ? "red" : "orange";

                if (Math.round(qty_to_display) > 999) {
                    qty_to_display = Math.round(qty_to_display) / 1000;
                    qty_to_display = qty_to_display.toFixed(1) + "K";
                }
            } else {
                indicator_color = "";
                qty_to_display = "";
            }

            function get_item_image_html() {
                if (!me.hide_images && item_image) {
                    return `<div class="item-qty-pill">
                                <span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
                            </div>
                            <div class="flex items-center justify-center h-32 border-b-grey text-6xl text-grey-100">
                                <img
                                    onerror="cur_pos.item_selector.handle_broken_image(this)"
                                    class="h-full item-img" src="${item_image}"
                                    alt="${frappe.abbr(item.item_name)}"
                                >
                            </div>`;
                } else {
                    if (me.hide_images) return ""
                    return `<div class="item-qty-pill">
                                <span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
                            </div>
                            <div class="item-display abbr">${abbr(item.item_name, description)}</div>`;
                }
            }

            function abbr(txt, desc) {
                console.log(txt, desc)
                if (!txt) return "";
                if (desc) {
                    const split = strip(desc).split(":")
                    if (split.length > 1) {
                        if (split[0].slice(-4) == "ABBR") {
                            return split[1].trim();
                        }
                    }
                }
                var abbr = "";
                $.each(txt.split("-"), function (i, w) {
                    if (abbr.length == 0) {
                        if (w.startsWith("Phal")) abbr = "Phal"
                        else if (w.startsWith("Dend")) abbr = "Dend"
                        else {
                            abbr = w.substring(0, 3) + " "
                        }
                    } else {
                        if (w == "Tronco")
                            abbr += " Tronco";
                        else {
                            abbr += " " + w.trim()[0];
                            if (isNumber(w.slice(-1))) {
                                if (isNumber(w.slice(-2))) {
                                    abbr += w.slice(-2);
                                } else {
                                    abbr += w.slice(-1);
                                }
                            }
                        }
                    }
                });

                return abbr || "?";
            };

            function strip(html){
                let doc = new DOMParser().parseFromString(html, 'text/html');
                return doc.body.textContent || "";
             }


            function isNumber(num) {
                switch (typeof num) {
                    case 'number':
                        return num - num === 0;
                    case 'string':
                        if (num.trim() !== '')
                            return Number.isFinite ? Number.isFinite(+num) : isFinite(+num);
                        return false;
                    default:
                        return false;
                }
            }

            return `<div class="item-wrapper"
                    data-item-code="${escape(item.item_code)}" data-serial-no="${escape(serial_no)}"
                    data-batch-no="${escape(batch_no)}" data-uom="${escape(uom)}"
                    data-rate="${escape(price_list_rate || 0)}"
                    title="${item.item_name}">
    
                    ${get_item_image_html()}
    
                    <div class="item-detail">
                        <div class="item-name">
                            ${frappe.ellipsis(item.item_name, 38)}
                        </div>
                        <div class="item-rate">${format_currency(price_list_rate, item.currency, precision) || 0} / ${uom == "Unidade" ? "un" : uom}</div>
                    </div>
                </div>`;
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
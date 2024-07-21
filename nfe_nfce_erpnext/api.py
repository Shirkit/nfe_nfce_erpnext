import base64
import json
import os
import re

import frappe
import phonenumbers
import requests
import unidecode
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from frappe.desk.form.linked_with import get_linked_docs, get_linked_doctypes
from frappe.utils.file_manager import save_url

tempStates = {
    "Acre": "AC",
    "Alagoas": "AL",
    "Amapá": "AP",
    "Amazonas": "AM",
    "Bahia": "BA",
    "Ceará": "CE",
    "Distrito Federal": "DF",
    "Espírito Santo": "ES",
    "Goiás": "GO",
    "Maranhão": "MA",
    "Mato Grosso": "MT",
    "Mato Grosso do Sul": "MS",
    "Minas Gerais": "MG",
    "Pará": "PA",
    "Paraíba": "PB",
    "Paraná": "PR",
    "Pernambuco": "PE",
    "Piauí": "PI",
    "Rio de Janeiro": "RJ",
    "Rio Grande do Norte": "RN",
    "Rio Grande do Sul": "RS",
    "Rondônia": "RO",
    "Roraima": "RR",
    "Santa Catarina": "SC",
    "São Paulo": "SP",
    "Sergipe": "SE",
    "Tocantins": "TO",
}

states = {}

for state, sigla in tempStates.items():
    states[state] = sigla
    states[state.upper()] = sigla
    states[state.lower()] = sigla
    states[unidecode.unidecode(state)] = sigla
    states[unidecode.unidecode(state.upper())] = sigla
    states[unidecode.unidecode(state.lower())] = sigla

def loadField(name, loaded_json):
    field = loaded_json.get(name)
    if field is not None:
        return " ".join(str(field).strip().split()).upper()
    return None

def selectOption(toSelect, options):
    for option in options:
        if option.startswith("(" + toSelect + ")"):
            return option
    return None


def parseOption(option):
    if option is not None and option.startswith("("):
        return option[option.find("(") + 1 : option.find(")")]
    return option

def webmaniaSettings():
    settings = frappe.get_doc("Nota Fiscal Settings")
    obj = {
        "headers": {
            "cache-control": "no-cache",
            "content-type": "application/json",
            "x-consumer-key": settings.get_password("webmania_consumer_key"),
            "x-consumer-secret": settings.get_password("webmania_consumer_secret"),
            "x-access-token": settings.get_password("webmania_access_token"),
            "x-access-token-secret": settings.get_password(
                "webmania_access_token_secret"
            ),
        },
        "ambiente": parseOption(settings.webmania_ambiente),
    }
    return obj

@frappe.whitelist()
def signQz(message):
    key = serialization.load_pem_private_key(
        open("../apps/nfe_nfce_erpnext/nfe_nfce_erpnext/key.pem", "rb").read(),
        None,
        backend=default_backend(),
    )
    signature = key.sign(
        message.encode("utf-8"), padding.PKCS1v15(), hashes.SHA512()
    )  # Use hashes.SHA1() for QZ Tray 2.0 and older
    return str(base64.b64encode(signature))


@frappe.whitelist()
def emitirNotaFiscal(*args, **kwargs):

    loaded_json = None
    nota_db = None

    if kwargs.get("nota") is not None:
        nota_db = kwargs.get("nota")
    elif kwargs.get("source_name") is not None:
        loaded_json = json.loads(kwargs["source_name"])
    elif kwargs.get("doc") is not None:
        loaded_json = json.loads(kwargs["doc"])
    else:
        frappe.throw(
            title="Documento não encontrado",
            msg="O pedido para emitir a Nota Fiscal não foi encontrado.",
        )
        return json.dumps({"error": "Documento não encontrado."})

    if nota_db is None and loaded_json.get("docstatus") == 0:
        frappe.throw(
            title="Nota não submetida",
            msg="A Nota fiscal precisa ser submetida antes da emissão da mesma.",
        )
        return json.dumps(
            {
                "error": "Documento precisa ser submetido antes da emissão da Nota Fiscal."
            }
        )
    elif nota_db is None:
        nota_db = frappe.get_doc("Nota Fiscal", loaded_json.get("name"))

    if nota_db.docstatus != 1:
        frappe.throw(
            title="Nota não submetida",
            msg="A Nota fiscal precisa ser submetida antes da emissão da mesma.",
        )
        return json.dumps(
            {
                "error": "1 Documento precisa ser submetido antes da emissão da Nota Fiscal."
            }
        )

    settings = webmaniaSettings()

    result = {}
    result["operacao"] = int(parseOption(nota_db.operacao))
    result["natureza_operacao"] = nota_db.natureza_operacao
    result["modelo"] = int(parseOption(nota_db.modelo))
    result["finalidade"] = int(parseOption(nota_db.finalidade))
    result["ambiente"] = int(parseOption(nota_db.ambiente))
    if result["ambiente"] == 0:
        result["ambiente"] = settings["ambiente"]

    cliente = {}

    if nota_db.cpf is not None:
        cliente["cpf"] = nota_db.cpf
        cliente["nome_completo"] = nota_db.nome_completo
    elif nota_db.cnpj is not None:
        cliente["cnpj"] = nota_db.cnpj
        cliente["razao_social"] = nota_db.razao_social
        cliente["ie"] = nota_db.ie

    cliente["endereco"] = nota_db.endereco
    cliente["numero"] = nota_db.numero
    cliente["complemento"] = nota_db.complemento
    cliente["bairro"] = nota_db.bairro
    cliente["cidade"] = nota_db.cidade
    cliente["uf"] = parseOption(nota_db.uf)
    cliente["cep"] = nota_db.cep
    cliente["telefone"] = nota_db.telefone
    cliente["email"] = nota_db.email

    result["cliente"] = cliente

    produtos = []

    for item in nota_db.produtos:
        produto = {}
        produto["nome"] = item.get("nome")
        produto["codigo"] = item.get("codigo")
        produto["ncm"] = item.get("ncm")
        produto["quantidade"] = int(item.get("quantidade"))
        produto["unidade"] = parseOption(item.get("unidade"))
        produto["origem"] = int(parseOption(item.get("origem")))
        produto["desconto"] = item.get("desconto")
        produto["subtotal"] = item.get("subtotal")
        produto["total"] = item.get("total")
        produto["classe_imposto"] = item.get("classe_imposto")
        produto["cnpj_fabricante"] = item.get("cnpj_fabricante")
        produtos.append(produto)

    result["produtos"] = produtos

    pedido = {}
    pedido["presenca"] = int(parseOption(nota_db.presenca))
    pedido["modalidade_frete"] = int(parseOption(nota_db.modalidade_frete))
    pedido["frete"] = nota_db.frete
    pedido["desconto"] = nota_db.desconto
    pedido["informacoes_fisco"] = nota_db.informacoes_fisco
    pedido["informacoes_complementares"] = nota_db.informacoes_complementares
    pedido["observacoes_contribuinte"] = nota_db.observacoes_contribuinte

    pedido["pagamento"] = parseOption(nota_db.pagamento)
    pedido["desc_pagamento"] = nota_db.desc_pagamento
    if nota_db.formas_pagamento is not None and len(nota_db.formas_pagamento) > 0:
        pedido["forma_pagamento"] = []
        pedido["valor_pagamento"] = []
        for forma in nota_db.formas_pagamento:
            pedido["forma_pagamento"].append(parseOption(forma.forma_pagamento))
            pedido["valor_pagamento"].append(forma.valor_pagamento)
    else:
        pedido["forma_pagamento"] = parseOption(nota_db.forma_pagamento)
        pedido["valor_pagamento"] = nota_db.valor_pagamento

    transporte = {}
    transporte["volume"] = nota_db.volume
    transporte["especie"] = nota_db.especie
    transporte["peso_bruto"] = nota_db.peso_bruto
    transporte["peso_liquido"] = nota_db.peso_liquido

    if nota_db.entrega_cnpj is not None:
        transporte["cnpj"] = int(nota_db.entrega_cnpj)
        transporte["razao_social"] = nota_db.entrega_razao_social
    elif nota_db.entrega_cpf is not None:
        transporte["cpf"] = nota_db.entrega_cpf
        transporte["nome_completo"] = nota_db.entrega_nome_completo
        if nota_db.entrega_ie is not None:
            transporte["ie"] = int(nota_db.entrega_ie)
    transporte["uf"] = parseOption(nota_db.entrega_uf)
    transporte["cep"] = nota_db.entrega_cep
    transporte["endereco"] = nota_db.entrega_endereco
    transporte["numero"] = nota_db.entrega_numero
    transporte["complemento"] = nota_db.entrega_complemento
    transporte["bairro"] = nota_db.entrega_bairro
    transporte["cidade"] = nota_db.entrega_cidade
    # TODO entrega_telefone e entrega_email não está sendo salvo nem carregado
    # if nota_db.entrega_telefone is not None:
    #    transporte["telefone"] = int(nota_db.entrega_telefone)
    # transporte["email"] = nota_db.entrega_email

    result["pedido"] = pedido

    headers = settings["headers"]

    url = "https://webmaniabr.com/api/1/nfe/emissao/"

    dumps = json.dumps(result)

    response = requests.request("POST", url, data=dumps, headers=headers)

    if response.status_code != 200:
        # Uknown error
        frappe.throw(title="Erro ao emitir nota fiscal", msg=response.text)
        return response.text

    if "json" not in response.headers["content-type"]:
        frappe.throw(title="Erro ao emitir nota fiscal", msg=response.text)
        return response.text

    returned_json = response.json()

    if returned_json.get("error") is not None:
        frappe.throw(title="Erro ao emitir nota fiscal", msg=response.text)
        return response.text

    if returned_json.get("status") == "reprovado":
        frappe.throw(title="Erro ao emitir nota fiscal", msg=response.text)
        return json.dumps({"error": returned_json.get("motivo")})

    if returned_json.get("status") == "aprovado":
        # TODO anexar o XML e a Danfe
        # print(nota_db.chave)
        nota_db.db_set("status", returned_json.get("status"), notify=True)
        nota_db.db_set("chave", returned_json.get("chave"), commit=True)
        # print(returned_json.get("danfe"))
        # add_attachments("Nota Fiscal", nota_db.name, [returned_json.get("danfe")]
        # f = save_url(returned_json.get("danfe"), returned_json.get("chave") + ".danfe.pdf", "Nota Fiscal", nota_db.name, None, True)
        # print(f.as_dict())
        # f.submit()
        # f.save()
        # f.insert()
        # f.notify_update()
        # print(f.is_remote_file)
        nota_db.notify_update()
        return json.dumps(
            {
                "success": True,
                "chave": returned_json.get("chave"),
                "modelo": returned_json.get("modelo"),
                "xml": returned_json.get("xml"),
                "danfe": returned_json.get("danfe"),
                "danfe_simples": returned_json.get("danfe_simples"),
                "danfe_etiqueta": returned_json.get("danfe_etiqueta"),
            }
        )

    frappe.throw(title="Erro desconhecido emitir nota fiscal", msg=response.text)
    return json.dumps({"error": "Erro desconhecido."})


@frappe.whitelist()
def imprimirNotaFiscal(*args, **kwargs):
    server_doc = None

    if kwargs.get("server_pos_invoice") is not None:
        server_doc = frappe.get_doc("POS Invoice", kwargs["server_pos_invoice"])
    else:
        frappe.throw(
            title="Pedido não encontrado",
            msg="Um pedido precisa existir antes de imprimir uma Nota fiscal.",
        )
        return json.dumps(
            {"error": "Um pedido precisa existir antes de imprimir uma Nota fiscal."}
        )

    if server_doc.nf_ultima_nota is None:
        frappe.throw(
            title="Nota não encontrada",
            msg="Uma Nota fiscal precisa existir antes de imprimir a mesma.",
        )
        return json.dumps(
            {"error": "Uma Nota fiscal precisa existir antes de imprimir a mesma."}
        )

    nota = frappe.get_doc("Nota Fiscal", server_doc.nf_ultima_nota)

    if nota.status == "processamento":
        frappe.throw(
            title="Nota em processamento",
            msg="A Nota fiscal ainda está em processamento.",
        )
        return json.dumps({"error": "A Nota fiscal ainda está em processamento."})

    if nota.status == "contingencia":
        frappe.throw(
            title="Nota em contingência", msg="A Nota fiscal está em contingência."
        )
        return json.dumps({"error": "A Nota fiscal está em contingência."})

    if nota.status != "aprovado":
        frappe.throw(title="Nota não aprovada", msg="A Nota fiscal não foi aprovada.")
        return json.dumps({"error": "A Nota fiscal não foi aprovada."})

    html = requests.request("GET", "https://nfe.webmaniabr.com/danfe/" + nota.chave)

    return json.dumps({"html": html.text})


@frappe.whitelist()
def criarNotaFiscal(*args, **kwargs):

    insert = kwargs.get("insert") if kwargs.get("insert") is not None else False
    submit = kwargs.get("submit") if kwargs.get("submit") is not None else False
    modelo = kwargs.get("modelo") if kwargs.get("modelo") is not None else 2

    server_doc = None
    # TODO migrar para apenas server_doc para conferência do pedido
    if kwargs.get("server_pos_invoice") is not None:
        server_doc = frappe.get_doc("POS Invoice", kwargs["server_pos_invoice"].name)
    else:
        frappe.throw(
            title="Pedido não encontrado",
            msg="Um pedido precisa existir antes de criar uma Nota fiscal.",
        )
        return json.dumps(
            {"error": "Um pedido precisa existir antes de criar uma Nota fiscal."}
        )

    if server_doc.nf_ultima_nota is not None:
        ultima = frappe.get_doc("Nota Fiscal", server_doc.nf_ultima_nota)
        if ultima.docstatus.is_draft():
            return ultima
        elif ultima.docstatus.is_submitted():
            if (
                ultima.status == "aprovado"
                or ultima.status == "processamento"
                or ultima.status == "contingencia"
            ):
                return ultima

    nota = frappe.new_doc("Nota Fiscal")

    nota.id = server_doc.name[-15:]
    customer = server_doc.customer

    nota.modelo = selectOption(
        str(modelo),
        frappe.get_meta("Nota Fiscal").get_field("modelo").options.split("\n"),
    )
    modelo = parseOption(nota.modelo)

    customer = frappe.get_doc("Customer", customer)
    linked = get_linked_docs(
        "Customer", customer.name, linkinfo=get_linked_doctypes("Customer")
    )

    contacts = linked.get("Contact")

    if customer.tax_id is not None:
        if customer.customer_type == "Company":
            nota.cnpj = re.sub("\D", "", customer.tax_id)
            nota.razao_social = customer.nf_razao_social
            nota.ie = customer.nf_inscricao_estadual
        elif customer.customer_type == "Individual":
            nota.cpf = re.sub("\D", "", customer.tax_id)
            nota.nome_completo = customer.customer_name

    # TODO calcular "Consumidor Final" e "Contribuinte"

    if customer.customer_primary_address is not None:
        primary_address = frappe.get_doc("Address", customer.customer_primary_address)
        nota.email = primary_address.email_id
        nota.telefone = primary_address.phone

    if customer.customer_primary_contact is not None:
        primary_contact = frappe.get_doc("Contact", customer.customer_primary_contact)
        nota.email = (
            primary_contact.email_id
            if nota.email is None
            else nota.email + "," + primary_contact.email_id
        )
        nota.telefone = (
            primary_contact.phone
            if nota.telefone is None
            else nota.telefone + "," + primary_contact.phone
        )

    # if server_doc.customer_address is not None:
    #     address = frappe.get_doc("Address", server_doc.customer_address)
    #     addresses = linked.get("Address")
    #     if address is not None:
    #         pass

    if modelo == 1:
        for address in addresses:
            address = frappe.get_doc("Address", address.name)
            if address.address_type == "Billing":
                if (
                    address.city is not None
                    and address.address_line1 is not None
                    and address.pincode is not None
                ):
                    nota.endereco = address.address_line1
                    nota.numero = address.number
                    nota.complemento = address.address_line2
                    nota.bairro = address.neighborhood
                    nota.cidade = address.city
                    nota.uf = selectOption(
                        (
                            states.get(address.state)
                            if address.state in states
                            else states.get(address.state.lower())
                        ),
                        frappe.get_meta("Nota Fiscal")
                        .get_field("uf")
                        .options.split("\n"),
                    )
                    nota.cep = re.sub("\D", "", address.pincode)
                    nota.email = (
                        address.email_id
                        if nota.email is None
                        else nota.email + "," + address.email_id
                    )
                    nota.telefone = re.sub(
                        "\D",
                        "",
                        address.phone if nota.telefone is None else nota.telefone,
                    )

            if address.address_type == "Shipping" or address.is_shipping_address == 1:
                if (
                    address.city is not None
                    and address.address_line1 is not None
                    and address.pincode is not None
                ):
                    if customer.customer_type == "Company":
                        nota.entrega_cnpj = nota.cnpj
                        nota.entrega_razao_social = customer.nf_razao_social
                        nota.entrega_ie = customer.nf_inscricao_estadual
                    elif customer.customer_type == "Individual":
                        nota.entrega_cpf = nota.cpf
                        nota.entrega_nome_completo = customer.customer_name

                    nota.entrega_endereco = address.address_line1
                    nota.entrega_numero = address.number
                    nota.entrega_complemento = address.address_line2
                    nota.entrega_bairro = address.neighborhood
                    nota.entrega_cidade = address.city
                    nota.entrega_uf = selectOption(
                        (
                            states.get(address.state)
                            if address.state in states
                            else states.get(address.state.lower())
                        ),
                        frappe.get_meta("Nota Fiscal")
                        .get_field("uf")
                        .options.split("\n"),
                    )
                    nota.entrega_cep = re.sub("\D", "", address.pincode)

    for item in server_doc.items:
        produto = frappe.new_doc("Produto")
        produto_loaded = frappe.get_doc("Item", item.get("item_code"))

        produto.nome = produto_loaded.get("item_name")
        produto.codigo = produto_loaded.get("item_code")
        produto.ncm = re.sub("\D", "", produto_loaded.get("nf_ncm"))
        produto.quantidade = item.get("qty")
        produto.unidade = produto_loaded.get("nf_uom")
        produto.origem = produto_loaded.get("nf_origem")
        produto.desconto = item.get("discount_amount")
        produto.subtotal = item.get("price_list_rate")
        produto.total = produto.subtotal * produto.quantidade
        produto.classe_imposto = produto_loaded.get("nf_classe_imposto")
        produto.cnpj_fabricante = produto_loaded.get("nf_cnpj_fabricante")

        nota.produtos.append(produto)

    x = 0
    for payment in server_doc.payments:
        mode_of_payment = frappe.get_doc(
            "Mode of Payment",
            (
                payment.get("mode_of_payment")
                if isinstance(payment, dict)
                else payment.mode_of_payment
            ),
        )
        amnt = payment.get("amount") if isinstance(payment, dict) else payment.amount
        if amnt is None or amnt == 0:
            continue
        if x == 0:
            nota.valor_pagamento = amnt
            nota.forma_pagamento = mode_of_payment.nf_forma_de_pagamento
        elif x == 1:
            forma = frappe.new_doc("Forma de Pagamento")
            forma.forma_pagamento = mode_of_payment.nf_forma_de_pagamento
            forma.valor_pagamento = amnt
            nota.formas_pagamento.append(forma)

            forma = frappe.new_doc("Forma de Pagamento")
            forma.forma_pagamento = nota.forma_pagamento
            forma.valor_pagamento = nota.valor_pagamento
            nota.formas_pagamento.append(forma)
            nota.forma_pagamento = None
            nota.valor_pagamento = None
        else:
            forma = frappe.new_doc("Forma de Pagamento")
            forma.forma_pagamento = mode_of_payment.nf_forma_de_pagamento
            forma.valor_pagamento = amnt
            nota.formas_pagamento.append(forma)
        x = x + 1

    nota.link_id = server_doc.name
    nota.link = server_doc.doctype

    if parseOption(nota.ambiente) == "0":
        nota.ambiente = selectOption(
            webmaniaSettings()["ambiente"],
            frappe.get_meta("Nota Fiscal Settings")
            .get_field("webmania_ambiente")
            .options.split("\n"),
        )

    if insert and server_doc is not None:
        print("Inserting")
        nota.insert()
        nota.save()
        frappe.db.commit()
        server_doc.db_set("nf_ultima_nota", nota.name, notify=True, commit=True)
        #server_doc.save()

    if submit:
        nota.submit()
        frappe.db.commit()

    return nota

    # Produtos
    # item (sku) / nome / ncm / quantidade / unidade (medida) / peso (em kg) / origem / desconto (individual) / subtotal (valor integral sem desconto) / total ((subtotal - desconto) * quantidade) / classe_imposto / cnpj_fabricante

    # Pedido
    # presenca / modalidade_frete / frete / desconto / total / informacoes_fisco / informacoes_complementares / observacoes_contribuinte

    # Pedido - Pagamento
    # pagamento / forma_pagamento / desc_pagamento / valor_pagamento

    # Pedido - Fatura

    # Pedido - Parcelas

    # Transporte
    # volume / especie / peso_bruto / peso_liquido

    # Transporte - Entrega
    # cnpj / nome / ie / cpf / nome_completo / uf / cep / endereco / numero / complemento / bairro / cidade / telefone / email

    # print(result)


@frappe.whitelist()
def puxarDadosCNPJ(*args, **kwargs):

    loaded_json = json.loads(kwargs["doc"])
    cnpj = loaded_json.get("tax_id")
    if cnpj is not None:

        cnpj = re.sub("\D", "", cnpj)

        response = requests.request("GET", "https://publica.cnpj.ws/cnpj/" + cnpj)
        dados = json.loads(response.text)

        razao_social = loadField("razao_social", dados)
        estabelecimento = dados.get("estabelecimento")
        nome_fantasia = loadField("nome_fantasia", estabelecimento)
        tipo_logradouro = loadField("tipo_logradouro", estabelecimento)
        logradouro = loadField("logradouro", estabelecimento)
        numero = loadField("numero", estabelecimento)
        complemento = loadField("complemento", estabelecimento)
        bairro = loadField("bairro", estabelecimento)
        cep = loadField("cep", estabelecimento)
        pais = loadField("nome", estabelecimento.get("pais"))
        estado = loadField("nome", estabelecimento.get("estado"))
        cidade = loadField("nome", estabelecimento.get("cidade"))
        email = loadField("email", estabelecimento)
        dd1 = loadField("ddd1", estabelecimento)
        telefone1 = loadField("telefone1", estabelecimento)
        telefone = None
        if dd1 is not None and telefone1 is not None:
            telefone = re.sub("\D", "", dd1 + telefone1)
            phone = phonenumbers.parse(telefone, "BR")
            phone = phonenumbers.format_number(
                phone, phonenumbers.PhoneNumberFormat.E164
            )
            final = phone[5:]
            if len(final) == 8:
                final = final[:4] + "-" + final[4:]
            else:
                final = final[:5] + "-" + final[5:]
            telefone = phone[:3] + " " + phone[3:5] + " " + final

        inscricoes_estaduais = estabelecimento.get("inscricoes_estaduais")
        if len(inscricoes_estaduais) == 1:
            inscricao_estadual = inscricoes_estaduais[0].get("inscricao_estadual")

        customer = frappe.get_doc("Customer", nota_db.name)

        customer.nf_razao_social = razao_social
        customer.nf_inscricao_estadual = inscricao_estadual

        results = get_linked_docs(
            "Customer", customer.name, linkinfo=get_linked_doctypes("Customer")
        )

        addresses = results.get("Address")

        if addresses is None or len(addresses) == 0:
            address = frappe.new_doc("Address")
            address.address_title = customer.name + "-Cadastro"
            address.address_line1 = tipo_logradouro + " " + logradouro
            address.number = numero
            address.address_line2 = complemento
            address.neighborhood = bairro
            address.city = cidade
            address.state = estado
            address.pincode = cep
            address.email_id = email
            address.phone = telefone
            link = frappe.new_doc("Dynamic Link")
            link.link_doctype = "Customer"
            link.link_name = customer.name
            address.links.append(link)
            address.insert()

        customer.save()
        customer.notify_update()

        # TODO recarregar a página após salvar


def updatePosInvoice(doc, method=None):
    return

def submitPosInvoice(doc, method=None):
    nota = criarNotaFiscal(server_pos_invoice=doc, insert=True, submit=True, modelo=2)
    emitida = emitirNotaFiscal(nota=nota)
    return
